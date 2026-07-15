/**
 * Message Queue Utilities - Asynchronous job processing
 * 
 * Provides message queue capabilities for the AfyaHero Health system including:
 * - Job queue management with BullMQ patterns
 * - Background processing for long-running tasks
 * - Retry mechanisms with exponential backoff
 * - Dead letter queue handling
 * - Job prioritization
 */

import { Redis } from '@upstash/redis';
import { logger, measurePerformanceAsync } from './observability';

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead';

export interface JobData {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  maxRetries: number;
  retryCount: number;
  delay: number;
  timeout: number;
  status: JobStatus;
  result?: unknown;
  createdAt: number;
  scheduledAt?: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface JobHandler<T = unknown, R = unknown> {
  name: string;
  handler: (data: T, job: JobData) => Promise<R>;
  options?: JobHandlerOptions;
}

export interface JobHandlerOptions {
  concurrency?: number;
  maxRetries?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  timeout?: number;
  priority?: number;
  delay?: number;
}

export interface QueueStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  dead: number;
  avgProcessingTime: number;
  throughput: number; // jobs per minute
}

export interface QueueConfig {
  name: string;
  defaultJobOptions?: Partial<JobHandlerOptions>;
  redis?: {
    url: string;
    token: string;
  };
}

// ─── Redis Client ───────────────────────────────────────────────────────────

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    logger.warn('Redis not configured - queue disabled', {
      component: 'queue',
      action: 'getRedisClient',
    });
    return null;
  }
  
  try {
    redisClient = new Redis({
      url,
      token,
      automaticDeserialization: false,
    });
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client for queue', {
      component: 'queue',
      action: 'getRedisClient',
    }, undefined, error as Error);
    
    return null;
  }
}

// ─── In-Memory Queue Store ─────────────────────────────────────────────────

class InMemoryQueueStore {
  private jobs: Map<string, JobData> = new Map();

  private handlers: Map<string, JobHandler> = new Map();

  private processingJobs: Set<string> = new Set();

  private stats: {
    completed: number;
    failed: number;
    processingTimes: number[];
  } = {
    completed: 0,
    failed: 0,
    processingTimes: [],
  };
  
  async enqueue(job: JobData): Promise<void> {
    this.jobs.set(job.id, job);
    logger.debug('Job enqueued (in-memory)', {
      component: 'queue',
      action: 'enqueue',
    }, { jobId: job.id, type: job.type, priority: job.priority });
  }
  
  async dequeue(queueName: string): Promise<JobData | null> {
    // Find next pending job for this queue
    let nextJob: JobData | null = null;
    let highestPriority = -1;
    
    for (const job of this.jobs.values()) {
      if (
        job.status === 'pending' &&
        !this.processingJobs.has(job.id) &&
        (!job.scheduledAt || job.scheduledAt <= Date.now()) &&
        job.metadata?.queue === queueName
      ) {
        if (job.priority > highestPriority) {
          highestPriority = job.priority;
          nextJob = job;
        }
      }
    }
    
    if (nextJob) {
      this.processingJobs.add(nextJob.id);
      nextJob.startedAt = Date.now();
      
      logger.debug('Job dequeued (in-memory)', {
        component: 'queue',
        action: 'dequeue',
      }, { jobId: nextJob.id, type: nextJob.type });
    }
    
    return nextJob;
  }
  
  async complete(jobId: string, result?: unknown): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
      this.processingJobs.delete(jobId);
      this.stats.completed++;
      
      if (job.startedAt) {
        const processingTime = job.completedAt - job.startedAt;
        this.stats.processingTimes.push(processingTime);
        // Keep only last 100 processing times
        if (this.stats.processingTimes.length > 100) {
          this.stats.processingTimes.shift();
        }
      }
      
      logger.debug('Job completed (in-memory)', {
        component: 'queue',
        action: 'complete',
      }, { jobId, type: job.type });
    }
  }
  
  async fail(jobId: string, error: Error): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.retryCount++;
      job.failedAt = Date.now();
      job.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.processingJobs.delete(jobId);
      this.stats.failed++;
      
      if (job.retryCount < job.maxRetries) {
        // Schedule retry
        job.status = 'pending';
        const backoffDelay = this.calculateBackoff(job);
        job.scheduledAt = Date.now() + backoffDelay;
        
        logger.debug('Job scheduled for retry (in-memory)', {
          component: 'queue',
          action: 'retry',
        }, { jobId, retryCount: job.retryCount, delay: backoffDelay });
      } else {
        // Move to dead letter queue
        job.status = 'dead';
        
        logger.warn('Job moved to dead letter queue (in-memory)', {
          component: 'queue',
          action: 'dead',
        }, { jobId, retryCount: job.retryCount });
      }
    }
  }
  
  async getJob(jobId: string): Promise<JobData | null> {
    return this.jobs.get(jobId) || null;
  }
  
  async getStats(queueName: string): Promise<QueueStats> {
    const queueJobs = Array.from(this.jobs.values()).filter(
      j => j.metadata?.queue === queueName
    );
    
    return {
      pending: queueJobs.filter(j => j.status === 'pending').length,
      active: queueJobs.filter(j => j.status === 'active').length,
      completed: this.stats.completed,
      failed: this.stats.failed,
      delayed: queueJobs.filter(j => j.status === 'delayed').length,
      dead: queueJobs.filter(j => j.status === 'dead').length,
      avgProcessingTime: this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
        : 0,
      throughput: this.stats.completed > 0
        ? this.stats.completed / Math.max(1, (Date.now() - (this.stats.processingTimes[0] || Date.now())) / 60000)
        : 0,
    };
  }
  
  async clear(queueName: string): Promise<void> {
    for (const [id, job] of this.jobs.entries()) {
      if (job.metadata?.queue === queueName) {
        this.jobs.delete(id);
      }
    }
  }
  
  private calculateBackoff(job: JobData): number {
    const handler = this.handlers.get(job.type);
    const backoff = handler?.options?.backoff || { type: 'exponential' as const, delay: 1000 };
    
    if (backoff.type === 'fixed') {
      return backoff.delay;
    }
    
    // Exponential backoff: delay * 2^(retryCount-1)
    return backoff.delay * Math.pow(2, job.retryCount - 1);
  }
  
  registerHandler(handler: JobHandler): void {
    this.handlers.set(handler.name, handler);
  }
  
  getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }
}

const inMemoryStore = new InMemoryQueueStore();

// ─── Queue Service ──────────────────────────────────────────────────────────

class QueueService {
  private redis: Redis | null;

  private useRedis: boolean;

  private handlers: Map<string, JobHandler> = new Map();

  private isProcessing = false;

  private processInterval?: NodeJS.Timeout;
  
  constructor() {
    this.redis = getRedisClient();
    this.useRedis = this.redis !== null;
  }
  
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  private getQueueKey(queueName: string): string {
    return `queue:${queueName}`;
  }
  
  private getJobKey(jobId: string): string {
    return `job:${jobId}`;
  }
  
  /**
   * Register a job handler
   */
  registerHandler(handler: JobHandler): void {
    this.handlers.set(handler.name, handler);
    inMemoryStore.registerHandler(handler);
    
    logger.info('Job handler registered', {
      component: 'queue',
      action: 'registerHandler',
    }, { name: handler.name, concurrency: handler.options?.concurrency });
  }
  
  /**
   * Enqueue a job
   */
  async enqueue<T = unknown>(
    type: string,
    payload: T,
    options?: Partial<JobHandlerOptions> & {
      queue?: string;
      jobId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    const handler = this.handlers.get(type);
    const handlerOptions = handler?.options || {};
    
    const job: JobData = {
      id: options?.jobId || this.generateJobId(),
      type,
      payload,
      priority: options?.priority ?? handlerOptions.priority ?? 0,
      maxRetries: options?.maxRetries ?? handlerOptions.maxRetries ?? 3,
      retryCount: 0,
      delay: options?.delay ?? 0,
      timeout: options?.timeout ?? handlerOptions.timeout ?? 30000,
      status: 'pending',
      createdAt: Date.now(),
      scheduledAt: options?.delay ? Date.now() + options.delay : undefined,
      metadata: {
        queue: options?.queue || 'default',
        ...options?.metadata,
      },
    };
    
    return measurePerformanceAsync(
      `queue_enqueue_${type}`,
      async () => {
        // Store in in-memory queue
        await inMemoryStore.enqueue(job);
        
        // Store in Redis if available
        if (this.useRedis && this.redis) {
          try {
            const queueKey = this.getQueueKey(String(job.metadata?.queue ?? 'default'));
            const jobKey = this.getJobKey(job.id);
            
            // Add to queue set
            await this.redis.zadd(queueKey, {
              score: job.scheduledAt || job.createdAt,
              member: job.id,
            });
            
            // Store job data
            await this.redis.set(jobKey, JSON.stringify(job), {
              ex: 86400, // 24 hours TTL
            });
            
            logger.debug('Job enqueued (Redis)', {
              component: 'queue',
              action: 'enqueue',
            }, { jobId: job.id, type: job.type, queue: job.metadata?.queue });
          } catch (error) {
            logger.warn('Redis enqueue failed, using in-memory', {
              component: 'queue',
              action: 'enqueue',
            }, { jobId: job.id, error: error instanceof Error ? error.message : String(error) });
          }
        }
        
        return job.id;
      },
      { component: 'queue', action: 'enqueue' },
    );
  }
  
  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: JobStatus;
    job?: JobData;
  }> {
    const job = await inMemoryStore.getJob(jobId);
    
    if (job) {
      return {
        status: job.status as JobStatus,
        job,
      };
    }
    
    // Try Redis if available
    if (this.useRedis && this.redis) {
      try {
        const jobKey = this.getJobKey(jobId);
        const data = await this.redis.get<string>(jobKey);
        
        if (data) {
          const redisJob: JobData = JSON.parse(data);
          return {
            status: redisJob.status as JobStatus,
            job: redisJob,
          };
        }
      } catch {
        // Silently fail
      }
    }
    
    return { status: 'pending' }; // Job not found, assume not yet created
  }
  
  /**
   * Get queue stats
   */
  async getStats(queueName: string = 'default'): Promise<QueueStats> {
    return inMemoryStore.getStats(queueName);
  }
  
  /**
   * Start processing jobs
   */
  startProcessing(concurrency: number = 1): void {
    if (this.isProcessing) {
      logger.warn('Queue processing already started', {
        component: 'queue',
        action: 'startProcessing',
      });
      return;
    }
    
    this.isProcessing = true;
    
    // Process jobs periodically
    this.processInterval = setInterval(async () => {
      await this.processNext(concurrency);
    }, 100); // Check every 100ms
    
    logger.info('Queue processing started', {
      component: 'queue',
      action: 'startProcessing',
    }, { concurrency });
  }
  
  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = undefined;
    }
    this.isProcessing = false;
    
    logger.info('Queue processing stopped', {
      component: 'queue',
      action: 'stopProcessing',
    });
  }
  
  /**
   * Process next job
   */
  private async processNext(concurrency: number): Promise<void> {
    if (!this.isProcessing) return;
    
    const queues = Array.from(this.handlers.values())
      .map(h => h.name)
      .reduce((acc, _name) => {
        const queue = 'default'; // Simplified - could be per-handler
        if (!acc.includes(queue)) acc.push(queue);
        return acc;
      }, [] as string[]);
    
    for (const queue of queues) {
      for (let i = 0; i < concurrency; i++) {
        const job = await inMemoryStore.dequeue(queue);
        
        if (!job) continue;
        
        // Process job asynchronously
        this.processJob(job).catch(error => {
          logger.error('Job processing failed', {
            component: 'queue',
            action: 'processJob',
          }, { jobId: job.id, type: job.type }, error);
        });
      }
    }
  }
  
  /**
   * Process a single job
   */
  private async processJob(job: JobData): Promise<void> {
    const handler = inMemoryStore.getHandler(job.type);
    
    if (!handler) {
      logger.error('No handler found for job type', {
        component: 'queue',
        action: 'processJob',
      }, { jobId: job.id, type: job.type });
      
      await inMemoryStore.fail(job.id, new Error(`No handler for type: ${job.type}`));
      return;
    }
    
    const startTime = Date.now();
    
    try {
      logger.debug('Processing job', {
        component: 'queue',
        action: 'processJob',
      }, { jobId: job.id, type: job.type, retryCount: job.retryCount });
      
      const result = await handler.handler(job.payload as any, job);
      
      await inMemoryStore.complete(job.id, result);
      
      const duration = Date.now() - startTime;
      
      logger.info('Job completed', {
        component: 'queue',
        action: 'processJob',
        duration,
      }, { jobId: job.id, type: job.type });
    } catch (error) {
      await inMemoryStore.fail(job.id, error as Error);
      
      const duration = Date.now() - startTime;
      
      logger.error('Job failed', {
        component: 'queue',
        action: 'processJob',
        duration,
      }, {
        jobId: job.id,
        type: job.type,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
      }, error as Error);
    }
  }
  
  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = await inMemoryStore.getJob(jobId);
    
    if (!job || job.status !== 'pending') {
      return false;
    }
    
    job.status = 'dead'; // Mark as cancelled
    return true;
  }
  
  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<boolean> {
    const job = await inMemoryStore.getJob(jobId);
    
    if (!job || (job.status !== 'failed' && job.status !== 'dead')) {
      return false;
    }
    
    job.status = 'pending';
    job.retryCount = 0;
    job.error = undefined;
    job.scheduledAt = Date.now();
    
    return true;
  }
  
  /**
   * Clear queue
   */
  async clear(queueName: string = 'default'): Promise<void> {
    await inMemoryStore.clear(queueName);
    
    if (this.useRedis && this.redis) {
      try {
        const queueKey = this.getQueueKey(queueName);
        await this.redis.del(queueKey);
      } catch {
        // Silently fail
      }
    }
  }
}

// ─── Export Singleton ───────────────────────────────────────────────────────

export const queue = new QueueService();

// ─── Predefined Job Types ──────────────────────────────────────────────────

export const JobTypes = {
  // Notification jobs
  SEND_EMAIL: 'send_email',
  SEND_SMS: 'send_sms',
  SEND_PUSH: 'send_push',
  
  // Data processing jobs
  PROCESS_LAB_RESULTS: 'process_lab_results',
  GENERATE_REPORT: 'generate_report',
  SYNC_FHIR_DATA: 'sync_fhir_data',
  
  // Background sync jobs
  SYNC_INVENTORY: 'sync_inventory',
  UPDATE_METRICS: 'update_metrics',
  CLEANUP_EXPIRED_DATA: 'cleanup_expired_data',
  
  // AI processing jobs
  PROCESS_AI_QUERY: 'process_ai_query',
  GENERATE_AI_SUMMARY: 'generate_ai_summary',
  
  // Audit jobs
  AUDIT_LOG_EVENT: 'audit_log_event',
  PROCESS_AUDIT_LOGS: 'process_audit_logs',
} as const;

// ─── Job Registration Helpers ──────────────────────────────────────────────

export function registerJobHandler<T = unknown, R = unknown>(
  name: string,
  handler: (data: T, job: JobData) => Promise<R>,
  options?: JobHandlerOptions,
): void {
  queue.registerHandler({
    name,
    handler: handler as JobHandler['handler'],
    options,
  });
}

// ─── Convenience Functions ──────────────────────────────────────────────────

export async function enqueueJob<T = unknown>(
  type: string,
  payload: T,
  options?: Partial<JobHandlerOptions> & {
    queue?: string;
    jobId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  return queue.enqueue(type, payload, options);
}

export async function getJobStatus(jobId: string): Promise<{
  status: JobStatus;
  job?: JobData;
}> {
  return queue.getJobStatus(jobId);
}

export async function getQueueStats(queueName?: string): Promise<QueueStats> {
  return queue.getStats(queueName);
}

export function startQueueProcessing(concurrency?: number): void {
  queue.startProcessing(concurrency);
}

export function stopQueueProcessing(): void {
  queue.stopProcessing();
}

// ─── Initialize Default Handlers ────────────────────────────────────────────

// Register default handlers that can be overridden by specific implementations
registerJobHandler(
  JobTypes.AUDIT_LOG_EVENT,
  async (data: { type: string; userId: string; metadata?: Record<string, unknown> }, job) => {
    logger.info('Audit log event queued', {
      component: 'queue',
      action: JobTypes.AUDIT_LOG_EVENT,
    }, { eventType: data.type, userId: data.userId });
    
    // This would typically write to the audit log
    return { success: true, jobId: job.id };
  },
  { priority: 10, maxRetries: 5 },
);

registerJobHandler(
  JobTypes.SEND_EMAIL,
  async (data: { to: string; subject: string; body: string }, job) => {
    logger.info('Email job processed', {
      component: 'queue',
      action: JobTypes.SEND_EMAIL,
    }, { to: data.to, subject: data.subject });
    
    // This would typically send via an email service
    return { success: true, jobId: job.id };
  },
  { priority: 5, maxRetries: 3 },
);

registerJobHandler(
  JobTypes.SEND_SMS,
  async (data: { phone: string; message: string }, job) => {
    logger.info('SMS job processed', {
      component: 'queue',
      action: JobTypes.SEND_SMS,
    }, { phone: data.phone });
    
    // This would typically send via an SMS service
    return { success: true, jobId: job.id };
  },
  { priority: 5, maxRetries: 3 },
);
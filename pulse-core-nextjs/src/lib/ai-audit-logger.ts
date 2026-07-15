/**
 * AI Operations Audit Logger
 * 
 * Provides comprehensive audit logging for AI operations including:
 * - AI orchestration calls
 * - API endpoint access
 * - Data sent to external AI providers
 * - Response metadata
 * - Error tracking
 */

import logger from '@/lib/logger';
import { prisma } from '@/lib/database';
import type { Prisma } from '@prisma/client';

interface AIAuditLog {
  userId: string;
  hospitalId: string;
  operation: string;
  taskType: string;
  provider?: string;
  success: boolean;
  latencyMs: number;
  inputSize?: number;
  outputSize?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an AI operation to both the application logger and the database
 */
export async function logAIOperation(auditLog: AIAuditLog): Promise<void> {
  try {
    // Log to application logger
    logger.info('[AI Operation]', {
      userId: auditLog.userId,
      hospitalId: auditLog.hospitalId,
      operation: auditLog.operation,
      taskType: auditLog.taskType,
      provider: auditLog.provider,
      success: auditLog.success,
      latencyMs: auditLog.latencyMs,
      inputSize: auditLog.inputSize,
      outputSize: auditLog.outputSize,
      errorMessage: auditLog.errorMessage,
    });

    // Log to database for audit trail
    if (auditLog.success) {
      await prisma.auditLog.create({
        data: {
          actorId: auditLog.userId,
          hospitalId: auditLog.hospitalId,
          action: `ai:${auditLog.operation}`,
          resourceType: 'ai_operation',
          detail: {
            taskType: auditLog.taskType,
            provider: auditLog.provider,
            latencyMs: auditLog.latencyMs,
            inputSize: auditLog.inputSize,
            outputSize: auditLog.outputSize,
            success: true,
            metadata: auditLog.metadata,
          } as Prisma.InputJsonObject,
        },
      });
    } else {
      await prisma.auditLog.create({
        data: {
          actorId: auditLog.userId,
          hospitalId: auditLog.hospitalId,
          action: `ai:${auditLog.operation}:error`,
          resourceType: 'ai_operation',
          detail: {
            taskType: auditLog.taskType,
            errorMessage: auditLog.errorMessage,
            success: false,
            metadata: auditLog.metadata,
          } as Prisma.InputJsonObject,
        },
      });
    }
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error('[AI Audit Logger] Failed to log audit entry', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Wrapper function to automatically log AI operations
 */
export function withAIAuditLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    operation: string;
    taskType: string;
    getUserId: (...args: Parameters<T>) => string;
    getHospitalId: (...args: Parameters<T>) => string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const { operation, taskType, getUserId, getHospitalId } = options;
    const startTime = Date.now();

    try {
      const result = await fn(...args);
      const latencyMs = Date.now() - startTime;

      await logAIOperation({
        userId: getUserId(...args),
        hospitalId: getHospitalId(...args),
        operation,
        taskType,
        success: true,
        latencyMs,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      await logAIOperation({
        userId: getUserId(...args),
        hospitalId: getHospitalId(...args),
        operation,
        taskType,
        success: false,
        latencyMs,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }) as T;
}

/**
 * Get AI operation statistics for a hospital
 */
export async function getAIOperationStats(
  hospitalId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatencyMs: number;
  byTaskType: Record<string, number>;
  byProvider: Record<string, number>;
}> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        hospitalId,
        action: { startsWith: 'ai:' },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        action: true,
        detail: true,
        createdAt: true,
      },
    });

    const successfulOperations = logs.filter((log) => {
      const detail = log.detail as Record<string, unknown> | null;
      return detail?.success === true;
    }).length;
    const failedOperations = logs.filter((log) => {
      const detail = log.detail as Record<string, unknown> | null;
      return detail?.success === false;
    }).length;
    
    const byTaskType: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let totalLatencyMs = 0;
    let latencyCount = 0;

    for (const log of logs) {
      const details = log.detail as Record<string, unknown>;
      
      if (details.taskType) {
        byTaskType[details.taskType as string] = (byTaskType[details.taskType as string] || 0) + 1;
      }
      
      if (details.provider) {
        byProvider[details.provider as string] = (byProvider[details.provider as string] || 0) + 1;
      }
      
      if (details.latencyMs && typeof details.latencyMs === 'number') {
        totalLatencyMs += details.latencyMs;
        latencyCount++;
      }
    }

    return {
      totalOperations: logs.length,
      successfulOperations,
      failedOperations,
      averageLatencyMs: latencyCount > 0 ? totalLatencyMs / latencyCount : 0,
      byTaskType,
      byProvider,
    };
  } catch (error) {
    logger.error('[AI Audit Logger] Failed to get operation stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageLatencyMs: 0,
      byTaskType: {},
      byProvider: {},
    };
  }
}


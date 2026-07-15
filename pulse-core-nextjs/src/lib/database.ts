/**
 * Database Client for AfyaHero Health
 * 
 * Prisma ORM initialization with:
 * - Connection pooling configuration
 * - Transaction support
 * - Error handling
 * - Health checks
 * - Query logging in development
 * 
 * Note: Prisma client must be generated with `npx prisma generate` before use.
 */

// Lazy-load Prisma to avoid build-time errors when client isn't generated
 
let _PrismaClient:
  | (new (options?: import('@prisma/client').Prisma.PrismaClientOptions) => PrismaClientType)
  | undefined;
let _Prisma: typeof import('@prisma/client').Prisma | undefined;
let _sql: typeof import('@prisma/client').Prisma.sql | undefined;
let _PrismaPg: typeof import('@prisma/adapter-pg').PrismaPg | undefined;

function loadPrisma() {
  if (_PrismaClient) return;
  try {
     
    const prismaModule = require('@prisma/client');
    const prismaPgModule = require('@prisma/adapter-pg');
    _PrismaClient = prismaModule.PrismaClient;
    _Prisma = prismaModule.Prisma;
    _sql = prismaModule.sql;
    _PrismaPg = prismaPgModule.PrismaPg;
  } catch {
    // Prisma not generated — provide stubs for build
    _PrismaClient = class StubPrismaClient {
       
      async $connect() {}

       
      async $disconnect() {}

       
      async $queryRaw() { return []; }

       
      async $executeRaw() { return 0; }

       
      $use() {}

       
      $extends() { return this; }
    } as unknown as typeof import('@prisma/client').PrismaClient;
    _Prisma = {
      PrismaClientKnownRequestError: class extends Error { code = ''; },
      PrismaClientValidationError: class extends Error {},
      PrismaClientUnknownRequestError: class extends Error {},
      PrismaClientRustPanicError: class extends Error {},
    } as unknown as typeof import('@prisma/client').Prisma;
    _sql = (() => ({})) as unknown as typeof import('@prisma/client').Prisma.sql;
  }
}

loadPrisma();

import logger from '@/lib/logger';

let hasLoggedBuildTimeFallback = false;

function shouldAllowBuildTimeStub(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build'
  );
}

function createStubModel() {
  return new Proxy(
    {},
    {
      get: () =>
        async () => {
          return [];
        },
    },
  );
}

function createStubPrismaClientInstance(): PrismaClientType {
  const base = {
    async $connect() {},
    async $disconnect() {},
    async $queryRaw() { return []; },
    async $executeRaw() { return 0; },
    async $transaction<T>(input: (tx: unknown) => Promise<T>) {
      return input(createStubPrismaClientInstance());
    },
    $use() {},
    $extends() { return this; },
  };

  return new Proxy(base as unknown as PrismaClientType, {
    get(target, prop: string) {
      if (prop in target) return (target as unknown as Record<string, unknown>)[prop];
      return createStubModel();
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryLog {
  query: string;
  params: unknown[];
  duration: number;
  target: string;
}

/**
 * Prisma client type alias for reuse
 */
type PrismaClientType = InstanceType<typeof import('@prisma/client').PrismaClient>;

/**
 * Prisma transaction client type
 */
type PrismaTransactionClient = import('@prisma/client').Prisma.TransactionClient;

/**
 * Prisma SQL template type
 * Represents Prisma.sql template literal results
 */
type PrismaSqlTemplate = ReturnType<typeof import('@prisma/client').Prisma.sql>;

// ─── Prisma Client Configuration ──────────────────────────────────────────────

/**
 * Global Prisma client instance
 * Prevents multiple instances in development due to hot reloading
 */
const globalForPrisma = globalThis as unknown as {
   
  prisma: PrismaClientType | undefined;
};

/**
 * Create Prisma client with logging configuration
 */
function createPrismaClient() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required to initialize Prisma Client');
    }

    if (!_PrismaClient || !_PrismaPg) {
      throw new Error('Prisma Client or Prisma Postgres adapter could not be loaded');
    }

    const adapter = new _PrismaPg({ connectionString });

    return new _PrismaClient({
      adapter,
      log: isDevelopment
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (!shouldAllowBuildTimeStub()) {
      logger.error('Prisma client initialization failed', {
        error: errorMessage,
      });
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    if (!hasLoggedBuildTimeFallback) {
      hasLoggedBuildTimeFallback = true;
      logger.warn('Falling back to stub Prisma client during build', {
        error: errorMessage,
      });
    }
    return createStubPrismaClientInstance();
  }
}

/**
 * Get or create the Prisma client instance
 */
export function getPrismaClient(): PrismaClientType {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient() as PrismaClientType;

    if (process.env.NODE_ENV === 'development') {
      logger.debug('Prisma client initialized for development');
    }
  }
  
  return globalForPrisma.prisma;
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Default Prisma client instance
 */
export const prisma = getPrismaClient();

// ─── Multi-Tenancy Support ────────────────────────────────────────────────────

/**
 * Get a Prisma client bound to a specific hospital/facility
 * This enforces tenant isolation at the application level
 */
export function getTenantPrismaClient(hospitalId: string): PrismaClientType {
  if (!hospitalId) {
    throw new Error('hospitalId is required for tenant-bound queries');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          // Models that are known to be global or don't have hospitalId
          const globalModels = ['Hospital', 'User', 'UserSession', 'GlobalSettings'];

          if (!globalModels.includes(model)) {
            // Inject hospitalId into the where clause for read/update/delete operations
            if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              args.where = { ...(args.where as Record<string, unknown> ?? {}), hospitalId };
            }

            // Inject hospitalId into the data payload for create operations
            if (['create', 'createMany'].includes(operation)) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: Record<string, unknown>) => ({ ...d, hospitalId }));
              } else {
                args.data = { ...(args.data as Record<string, unknown> ?? {}), hospitalId };
              }
            }
          }

          return query(args);
        },
      },
    },
  }) as unknown as PrismaClientType;
}

// ─── Connection Management ────────────────────────────────────────────────────

/**
 * Connect to the database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Failed to disconnect from database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      healthy: true,
      responseTime,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Transaction Support ──────────────────────────────────────────────────────

/**
 * Execute operations within a transaction
 * 
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const patient = await tx.patient.create({ data: {...} });
 *   const appointment = await tx.appointment.create({ data: {...} });
 *   return { patient, appointment };
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  options?: {
    timeout?: number;
    maxWait?: number;
  }
): Promise<T> {
  return prisma.$transaction(fn, {
    timeout: options?.timeout ?? 5000,
    maxWait: options?.maxWait ?? 2000,
  });
}

/**
 * Execute multiple operations with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 100,
    backoff = 2,
  } = options ?? {};
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (isNonRetryableError(error)) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt);
        logger.warn(`Database operation failed, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`, {
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          maxRetries,
        });
        
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if an error is non-retryable
 */
function isNonRetryableError(error: unknown): boolean {
  const err = error as Record<string, unknown> | null;
  if (!err || typeof err.code !== 'string') {
    return false;
  }

  // Non-retryable error codes
  const nonRetryableCodes = [
    'P2000', // Value out of range
    'P2001', // Record not found
    'P2002', // Unique constraint failed
    'P2003', // Foreign key constraint failed
    'P2004', // Constraint violation
    'P2005', // Invalid value
    'P2006', // Invalid value for field
    'P2007', // Data validation error
    'P2008', // Query parsing error
    'P2009', // Query validation error
    'P2010', // Raw query failed
    'P2011', // Null constraint violation
    'P2012', // Required value missing
    'P2013', // Required argument missing
    'P2014', // Relation violation
    'P2015', // Related record not found
    'P2016', // JSON error
    'P2017', // Records not connected
    'P2018', // Connected records not found
    'P2019', // Input error
    'P2020', // Value out of range
    'P2021', // Table does not exist
    'P2022', // Column does not exist
    'P2023', // Inconsistent column
    'P2024', // Timeout fetching connection
    'P2025', // Operation relies on missing value
    'P2026', // Unsupported feature
    'P2027', // Multiple database errors
    'P2028', // Transaction already committed
    'P2030', // No full-text index
    'P2031', // MongoDB replica set required
    'P2033', // Number out of range
    'P2034', // Transaction failed due to deadlock
  ];
  
  return nonRetryableCodes.includes(err.code);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Execute a raw SQL query using Prisma's parameterized template literals.
 * This is safe against SQL injection because Prisma properly escapes all parameters.
 *
 * @example
 * ```typescript
 * const result = await executeRawQuery<T>(
 *   sql`SELECT * FROM patients WHERE hospital_id = ${hospitalId} AND name LIKE ${'%' + name + '%'}`
 * );
 * ```
 */
export async function executeRawQuery<T = unknown>(
  query: PrismaSqlTemplate,
): Promise<T[]> {
  try {
     
    const result = await (prisma).$queryRaw(query);
    return result as T[];
  } catch (error) {
    logger.error('Raw query execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Execute a raw SQL command (INSERT, UPDATE, DELETE) using Prisma's parameterized template literals.
 * This is safe against SQL injection because Prisma properly escapes all parameters.
 *
 * @example
 * ```typescript
 * const affected = await executeRawCommand(
 *   sql`UPDATE patients SET status = ${status} WHERE id = ${patientId}`
 * );
 * ```
 */
export async function executeRawCommand(
  query: PrismaSqlTemplate,
): Promise<number> {
  try {
     
    const result = await (prisma).$executeRaw(query);
    return result;
  } catch (error) {
    logger.error('Raw command execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ─── Pagination Helpers ───────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Execute a paginated query
 */
export async function paginate<T>(
  findManyFn: (args: { skip: number; take: number; orderBy?: Record<string, 'asc' | 'desc'> }) => Promise<T[]>,
  countFn: () => Promise<number>,
  params: PaginationParams = {}
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    findManyFn({
      skip,
      take: limit,
      orderBy: params.orderBy,
    }),
    countFn(),
  ]);
  
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

// ─── Error Handling ───────────────────────────────────────────────────────────

/**
 * Handle Prisma-specific errors
 */
export function handlePrismaError(error: unknown): {
  code: string;
  message: string;
  status: number;
} {
  const err = error as Record<string, unknown> | null;
  const code = err?.code as string | undefined;
  const message = err?.message as string | undefined;

  if (code) {
    switch (code) {
      case 'P2002':
        return { code: 'UNIQUE_CONSTRAINT', message: message || 'A record with this unique value already exists', status: 409 };
      case 'P2001':
        return { code: 'NOT_FOUND', message: message || 'Record not found', status: 404 };
      case 'P2025':
        return { code: 'RECORD_NOT_FOUND', message: message || 'Record to operate on was not found', status: 404 };
      case 'P2014':
        return { code: 'RELATION_VIOLATION', message: message || 'Operation would violate relation constraints', status: 400 };
      case 'P2003':
        return { code: 'FOREIGN_KEY_VIOLATION', message: message || 'Operation would violate foreign key constraints', status: 400 };
      case 'P2011':
        return { code: 'NULL_CONSTRAINT', message: message || 'Null value provided for required field', status: 400 };
      case 'P2000':
        return { code: 'VALUE_OUT_OF_RANGE', message: message || 'Value is out of range for the field', status: 400 };
      default:
        return { code: 'DATABASE_ERROR', message: message || 'Database operation failed', status: 500 };
    }
  }

  if (error instanceof Error) {
    return { code: 'VALIDATION_ERROR', message: error.message || 'Data validation failed', status: 400 };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    status: 500,
  };
}

// ─── Middleware for API Routes ───────────────────────────────────────────────

/**
 * Wrap an API route handler with database connection management
 */
export function withDatabase<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: unknown[]) => {
    try {
      // Ensure connection
      if (!prisma) {
        await connectDatabase();
      }
      
      return await handler(...args);
    } catch (error) {
      const prismaError = handlePrismaError(error);
      return Response.json(
        { error: prismaError.message, code: prismaError.code },
        { status: prismaError.status }
      );
    }
  }) as T;
}

// ─── Default Export ───────────────────────────────────────────────────────────

const databaseModule = {
  prisma,
  connectDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
  withTransaction,
  withRetry,
  executeRawQuery,
  executeRawCommand,
  paginate,
  handlePrismaError,
  withDatabase,
};

export default databaseModule;

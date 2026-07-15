/**
 * Database Query Optimization Utility
 * 
 * Provides utilities for optimizing database queries in population analytics
 * and other data-intensive operations.
 */

import { prisma } from '@/lib/database';

interface QueryOptions {
  select?: Record<string, boolean>;
  include?: Record<string, unknown>;
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
}

/**
 * Build optimized Prisma query with field selection
 */
export function buildOptimizedQuery(options: QueryOptions) {
  const { select, include, where, orderBy, take, skip } = options;

  const query: Record<string, unknown> = {};

  if (select) {
    query.select = select;
  }

  if (include) {
    query.include = include;
  }

  if (where) {
    query.where = where;
  }

  if (orderBy) {
    query.orderBy = orderBy;
  }

  if (take) {
    query.take = take;
  }

  if (skip) {
    query.skip = skip;
  }

  return query;
}

/**
 * Execute paginated query for large datasets
 */
export async function executePaginatedQuery<T>(
  model: string,
  options: QueryOptions & { page?: number; pageSize?: number }
): Promise<{ data: T[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const { page = 1, pageSize = 50, ...queryOptions } = options;
  const skip = (page - 1) * pageSize;

  const query = buildOptimizedQuery({
    ...queryOptions,
    take: pageSize,
    skip,
  });

  // Get data
  // @ts-ignore - Dynamic model access
  const data = await (prisma[model as keyof typeof prisma] as any).findMany(query);

  // Get total count
  // @ts-ignore - Dynamic model access
  const total = await (prisma[model as keyof typeof prisma] as any).count({
    where: queryOptions.where,
  });

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Execute batch query for multiple records
 */
export async function executeBatchQuery<T>(
  model: string,
  ids: string[],
  options: Omit<QueryOptions, 'where'>
): Promise<T[]> {
  if (ids.length === 0) return [];

  const query = buildOptimizedQuery({
    ...options,
    where: {
      id: { in: ids },
    },
  });

  // @ts-ignore - Dynamic model access
  return await (prisma[model as keyof typeof prisma] as any).findMany(query);
}

/**
 * Execute aggregated query for statistics
 */
export async function executeAggregatedQuery<T>(
  model: string,
  groupBy: string[],
  aggregations: Record<string, { _count?: boolean; _sum?: Record<string, boolean>; _avg?: Record<string, boolean> }>,
  where?: Record<string, unknown>
): Promise<T[]> {
  const query: Record<string, unknown> = {
    _count: aggregations._count,
    groupBy,
  };

  if (aggregations._sum) {
    query._sum = aggregations._sum;
  }

  if (aggregations._avg) {
    query._avg = aggregations._avg;
  }

  if (where) {
    query.where = where;
  }

  // @ts-ignore - Dynamic model access
  return await (prisma[model as keyof typeof prisma] as any).groupBy(query);
}

/**
 * Execute date-range optimized query
 */
export async function executeDateRangeQuery<T>(
  model: string,
  dateField: string,
  startDate: Date,
  endDate: Date,
  options: Omit<QueryOptions, 'where'>
): Promise<T[]> {
  const query = buildOptimizedQuery({
    ...options,
    where: {
      [dateField]: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // @ts-ignore - Dynamic model access
  return await (prisma[model as keyof typeof prisma] as any).findMany(query);
}

/**
 * Select only necessary fields for population analytics
 */
export const POPULATION_ANALYTICS_SELECT = {
  id: true,
  createdAt: true,
  // Add specific fields based on the model
};

/**
 * Index hints for commonly queried fields
 */
export const INDEX_HINTS = {
  consultations: ['patientId', 'createdAt', 'status'],
  patients: ['hospitalId', 'createdAt'],
  appointments: ['patientId', 'date', 'status'],
  labRequests: ['patientId', 'requestedAt', 'status'],
  prescriptions: ['patientId', 'prescribedAt'],
};

/**
 * Cache key generator for population analytics queries
 */
export function generateCacheKey(
  model: string,
  operation: string,
  params: Record<string, unknown>
): string {
  const paramsStr = JSON.stringify(params);
  return `db:${model}:${operation}:${paramsStr}`;
}

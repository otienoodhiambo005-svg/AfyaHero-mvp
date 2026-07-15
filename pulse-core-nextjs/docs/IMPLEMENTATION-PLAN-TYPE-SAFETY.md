# Type Safety Implementation Plan

## Overview

This document outlines a phased implementation plan to address the 117 files containing `: any` types identified in the full system audit. The goal is to improve TypeScript type safety across the codebase, particularly in AI-related code where strict typing is required per AGENTS.md.

## Priority Classification

### P0 - Critical (AI-Related Code)
- `src/types/clinical_ai.ts` (2 instances)
- `src/lib/ai-*.ts` files (AI providers, orchestration, etc.)
- `src/components/ai/*.tsx` files
- `src/hooks/useDiagnosticAI.ts`, `src/hooks/useAfyaAIChat.ts`

### P1 - High Priority (API Routes & Database)
- `src/app/api/**/*.ts` files with `: any` in response handling
- `src/lib/database.ts` (8 instances)
- Database query result type definitions

### P2 - Medium Priority (Components & UI)
- `src/components/**/*.tsx` files
- Form handling and event handler types
- External API integration types

### P3 - Low Priority (Configuration & Utilities)
- `src/lib/compliance/*.ts` files
- `src/lib/settings/*.ts` files
- Configuration and environment-related types

## Phase 1: AI-Related Code (Week 1)

### Files to Fix
1. `src/types/clinical_ai.ts` - Define proper interfaces for AI responses
2. `src/lib/ai-providers.ts` - Type AI provider responses
3. `src/lib/ai-orchestrator.ts` - Type orchestration data structures
4. `src/lib/ai-laboratory.ts` - Type lab AI responses
5. `src/lib/ai-pharmacy.ts` - Type pharmacy AI responses
6. `src/lib/ai-news-processor.ts` - Type news processing data
7. `src/lib/ai-mch.ts` - Type maternal child health AI data
8. `src/hooks/useDiagnosticAI.ts` - Type diagnostic AI hooks
9. `src/hooks/useAfyaAIChat.ts` - Type chat hooks
10. `src/components/ai/DawaChatSidebar.tsx` - Type chat component props

### Approach
- Extract common AI response types to shared interfaces
- Create union types for provider-specific responses
- Add proper error type handling
- Ensure all AI-related code uses strict typing

## Phase 2: API Routes & Database (Week 2-3)

### Database Types
1. `src/lib/database.ts` - Add proper Prisma result types
   - Replace `: any` in query results with proper Prisma generated types
   - Create type guards for runtime validation

### API Response Types
2. Create shared API response type definitions:
   ```typescript
   type ApiResponse<T> = {
     data?: T;
     error?: string;
     success?: boolean;
   };
   ```

3. Fix high-traffic API routes:
   - `src/app/api/medical/**/*.ts`
   - `src/app/api/admin/**/*.ts`
   - `src/app/api/pharmacy/**/*.ts`
   - `src/app/api/lab/**/*.ts`

### Approach
- Use Prisma's type inference where possible
- Create mapper functions to transform Prisma types to API types
- Add Zod schemas for runtime validation
- Document API response types in JSDoc

## Phase 3: Components & UI (Week 4)

### Component Props
1. Form components - Type form data and handlers
2. Data display components - Type data props
3. Interactive components - Type event handlers

### Files to Fix
- `src/components/portal/**/*.tsx`
- `src/components/medical/**/*.tsx`
- `src/components/pharmacy/**/*.tsx`

### Approach
- Extract common prop types to shared interfaces
- Use generic types for reusable components
- Add proper event handler types

## Phase 4: Configuration & Utilities (Week 5)

### Files to Fix
- `src/lib/compliance/*.ts`
- `src/lib/settings/*.ts`
- `src/lib/fhir/*.ts`
- `src/lib/speech-service.ts`

### Approach
- Create strict configuration types
- Add validation schemas for config objects
- Type external service responses

## Implementation Guidelines

### When to Use `unknown` vs `any`
- **Never use `any`** in AI-related code (per AGENTS.md)
- Use `unknown` for truly unknown data from external sources
- Always validate `unknown` before use with type guards

### Type Guard Pattern
```typescript
function isKnownType(value: unknown): value is ExpectedType {
  return typeof value === 'object' && value !== null && 'property' in value;
}
```

### Validation Pattern
```typescript
import { z } from 'zod';

const Schema = z.object({
  field: z.string(),
});

function validateData(data: unknown): ResultType {
  return Schema.parse(data);
}
```

## Success Criteria

- Zero `: any` types in AI-related code
- < 20 `: any` types remaining in codebase (only in unavoidable cases)
- All API routes have properly typed responses
- All database queries use Prisma types
- TypeScript strict mode enabled (if not already)

## Risk Mitigation

### Breaking Changes
- Some type fixes may require API contract changes
- Plan for versioning if external integrations affected
- Communicate changes to team before deployment

### Testing Strategy
- Add type tests for critical interfaces
- Run TypeScript compiler in CI/CD
- Use `tsc --noEmit` as pre-commit hook

## Progress Tracking

- Phase 1: [ ] 0/10 files
- Phase 2: [ ] 0/50 files
- Phase 3: [ ] 0/30 files
- Phase 4: [ ] 0/27 files

Total: 117 files with `: any` types

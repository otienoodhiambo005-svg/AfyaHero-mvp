# Reception Contract Tests

## Purpose

These tests validate key reception API contracts and security posture for:

- `POST /api/v1/patients/resolve`
- `POST /api/v1/patients/:id/merge`
- `GET /api/reception/queue/stream`

They are intentionally lightweight contract checks, not full end-to-end workflow validation.

## Run

From repository root:

```bash
npm run test:reception-contracts
```

This runs:

- `tests/reception-api-contracts.spec.ts`
- `tests/reception-api-authenticated-shapes.spec.ts`

on Chromium only for faster feedback.

## Result Semantics

### Pass

Tests can pass in two valid conditions:

1. **Authenticated contract path available**
   - Demo session is available.
   - Endpoints respond as expected (status + shape assertions).

2. **Secure denial path**
   - Demo session is unavailable.
   - Protected endpoints correctly return `401` or `403`.

### Skip

A test may be marked skipped when:

- Authenticated path is attempted, but endpoint responds with `5xx`.
- This usually indicates environment/infrastructure readiness issues (e.g. database/client bootstrap), not a contract regression.

`skip` in this suite means "contract assertion not executable in current environment," not "success."

### Fail

A failure indicates contract drift or security regression, for example:

- Wrong status code for known validation path.
- Missing response keys (`status`, `confidence`, `duplicateRisk`, `candidates`).
- Queue stream not returning `text/event-stream`.
- Protected endpoint unexpectedly allows anonymous access.

## Recommended CI Policy

- Keep these tests in required checks for reception/backend changes.
- Treat `fail` as blocking.
- Review `skip` counts; persistent skips should trigger infra follow-up.
- Pair with broader Playwright/UI suites for end-to-end confidence.


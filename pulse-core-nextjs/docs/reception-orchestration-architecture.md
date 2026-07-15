# Reception Orchestration Hub Architecture

## Objective

Upgrade the reception portal from check-in UI to an AI-native orchestration hub while preserving clinical safety, auditability, and resilience.

This plan is grounded in current code under:
- `src/app/portal/reception/*`
- `src/app/api/reception/*`
- `src/components/portal/*`
- `src/components/ai/DawaChat.tsx`

## Current Baseline (Verified)

- Reception has role-gated shell and core workflows:
  - check-in (`/portal/reception/checkin`)
  - appointments (`/portal/reception/appointments`)
  - queue (`/portal/reception/queue`)
  - routing orders (`/portal/reception/orders`)
  - patients register (`/portal/reception/patients`)
- Real APIs exist for reception workflows:
  - `POST /api/reception/checkins`
  - `GET/PATCH /api/reception/appointments`
  - `GET /api/reception/queue`
  - `POST /api/reception/queue/action`
  - `GET /api/reception/patients`
  - `GET/POST /api/reception/orders`
- Gaps remain in:
  - smart ID verification (current ID proofing is simulated)
  - real-time orchestration (polling-heavy, limited push)
  - document/consent and insurance automation
  - offline command sync
  - superadmin-grade operational analytics for reception

## Target Capability Model

1. Smart patient identification  
2. Intelligent triage and routing  
3. Real-time queue orchestration  
4. Document/consent automation  
5. Receptionist action assistant  
6. Integration endpoints (patient app, nurse/doctor stations, payer APIs)  
7. Offline and resilience mode  
8. Operations dashboard and predictive capacity

## Domain Entities and State Machines

Define explicit state with immutable audit transitions.

- `PatientIdentity`
  - `unverified -> partially_verified -> verified -> merged | flagged`
- `EncounterCheckIn`
  - `initiated -> identity_verified -> consent_pending -> insurance_pending -> triage_pending -> queued -> routed -> completed | cancelled`
- `TriageAssessment`
  - `pending -> in_progress -> scored -> clinician_reviewed -> finalized | superseded`
- `QueueTicket`
  - `issued -> waiting -> called -> in_service -> completed | skipped | cancelled`
- `RoutingAssignment`
  - `unassigned -> proposed -> confirmed -> room_assigned -> patient_arrived | rerouted`
- `ConsentRecord`
  - `not_required | required_pending -> provided | declined | expired`
- `InsuranceEligibility`
  - `not_started -> requested -> eligible | ineligible | manual_review | timeout`
- `EscalationCase`
  - `open -> acknowledged -> in_progress -> resolved | dismissed`

## API Architecture (v1 Namespacing)

Use versioned orchestration APIs under `/api/v1/*` and keep legacy reception APIs during migration.

### Identity
- `POST /api/v1/patients/resolve`
- `POST /api/v1/patients/:id/verify`
- `POST /api/v1/patients/:id/merge`

### Check-in and Encounter
- `POST /api/v1/encounters/check-in`
- `GET /api/v1/encounters/:id`
- `POST /api/v1/encounters/:id/cancel`

### Triage
- `POST /api/v1/encounters/:id/triage/start`
- `POST /api/v1/encounters/:id/triage/update`
- `POST /api/v1/encounters/:id/triage/finalize`
- `POST /api/v1/encounters/:id/triage/override`

### Queue and Routing
- `POST /api/v1/queues/:queueId/tickets`
- `GET /api/v1/queues/:queueId/tickets`
- `POST /api/v1/tickets/:id/call`
- `POST /api/v1/tickets/:id/complete`
- `POST /api/v1/encounters/:id/routing/propose`
- `POST /api/v1/encounters/:id/routing/confirm`

### Consent and Documents
- `GET /api/v1/encounters/:id/consents`
- `POST /api/v1/encounters/:id/consents/:type/capture`
- `POST /api/v1/encounters/:id/documents/ocr`

### Insurance
- `POST /api/v1/encounters/:id/eligibility/check`
- `GET /api/v1/encounters/:id/eligibility`

### Escalation and Notifications
- `POST /api/v1/encounters/:id/escalations`
- `POST /api/v1/escalations/:id/ack`
- `POST /api/v1/notifications/send`

## Event-Driven Orchestration

Adopt transactional outbox + realtime fanout:

- Write domain update and event in same transaction.
- Dispatcher publishes to realtime channels.
- UI consumes channels with polling fallback.

Event envelope:
- `eventId`, `eventType`, `aggregateType`, `aggregateId`
- `encounterId`, `siteId`, `occurredAt`
- `correlationId`, `causationId`, `schemaVersion`
- `payload`, `metadata`

Required events:
- `arrival.recorded`
- `triage.updated`
- `queue.reordered`
- `room.assigned`
- `escalation.triggered`
- `notification.sent`

## AI Boundaries

AI is assistive, rules are authoritative.

Assistive only:
- symptom summarization
- triage suggestion
- queue/routing recommendation
- conflict-resolution options

Deterministic safety rules:
- red-flag auto-escalation guardrails
- consent gating
- identity verification policy thresholds
- queue SLA breach rules

Every AI recommendation must return:
- `modelVersion`
- `confidence`
- `explanation`
- `inputFingerprint`

## Offline and Resilience Design

- PWA + IndexedDB command queue for reception actions.
- Commands include `commandId`, `aggregateId`, `baseVersion`.
- Sync engine replays in order when online.
- Conflict policy:
  - clinical/safety fields: server authoritative (409 + manual review)
  - non-critical notes: controlled merge policy
- Fallback mode:
  - local cache for today appointments/queue
  - clear pending/synced/conflict UX state

## Safety and Compliance Controls

### P0 (Before live use)
- Explicit biometric consent flow with non-biometric alternative.
- Human sign-off mandatory for triage/routing suggestions.
- Hard-stop red flags (never downgraded by AI).
- Immutable audit logs for all decisions and overrides.
- MFA + role-scoped API authorization.
- Encryption in transit/at rest.

### P1 (Scale readiness)
- Consent ledger versioning.
- Drift/bias monitoring for triage outcomes.
- Break-glass access workflow with alerting.
- Circuit breakers for payer/notification APIs.

### P2 (Optimization)
- periodic consent refresh
- advanced anomaly detection
- continuous attack simulation

## Delivery Plan

### Phase 1: Stabilize Core Orchestration
- replace simulated ID checks with real API contract
- add stateful encounter + queue ticket transitions
- add outbox and idempotency keys

### Phase 2: Real-time + Assistant Actions
- realtime queue updates (SSE or channel subscriptions)
- DAWA receptionist actions bound to constrained tools
- automated arrival notifications to nurse/doctor surfaces

### Phase 3: Consent/Insurance/Docs
- digital consent capture
- OCR ingestion for referral docs
- payer eligibility checks + manual review fallback

### Phase 4: Offline + Predictive Ops
- offline command queue and sync conflict tooling
- wait-time prediction and peak-hour forecasting
- staffing risk alerts

## Repo-First Quick Wins

1. Convert `src/components/portal/IDCheckModal.tsx` from mock verification to API-backed verification + audit trail.
2. Upgrade `src/app/portal/reception/queue/page.tsx` to realtime subscription with polling fallback.
3. Trigger communications from `src/app/api/reception/checkins/route.ts` and appointments updates.
4. Add action-safe tools behind `src/app/api/ai/dawa/route.ts` for receptionist commands.
5. Rewire `src/app/portal/reception/reports/page.tsx` and `finance/page.tsx` to live metrics.

## Success KPIs

- check-in completion time (median, p95)
- door-to-triage time
- queue prediction error
- escalation detection-to-ack time
- insurance check success latency
- offline sync conflict rate
- AI suggestion acceptance vs override rate


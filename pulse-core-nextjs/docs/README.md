# Documentation Index

This index helps engineering teams quickly find operational and integration documentation for portal workflows.

## Core Architecture

- [Reception Orchestration Architecture](./reception-orchestration-architecture.md)

## API Contracts

- [Integration Endpoints Contracts](./integration-endpoints-contracts.md)

## Breaking Changes and Migration Checklist (Apr 2026)

The following contract changes are safety-related and should be treated as required updates for all internal and external clients.

- **Clinical write identity is strict**
  - `POST /api/medical/vitals` now requires `patientId`.
  - `POST /api/medical/medications/administer` now requires `patientId`.
  - Remove all `patientName`-only write flows.

- **Bed allocation conflict semantics**
  - `POST /api/medical/beds/allocate` now uses atomic claim behavior.
  - Handle `409` as a normal concurrency outcome (bed already claimed).
  - UI should refresh bed state and prompt user to select another bed.

- **CHP care-plan persistence is immutable**
  - `POST /api/apps/chp/care-plans` is append-only version creation.
  - Expect `201` on successful write.
  - Do not rely on in-place update semantics.

### Integration Checklist

- [ ] Ensure all vitals and medication payloads include canonical `patientId`.
- [ ] Remove legacy fallbacks that infer patient by display name.
- [ ] Add/verify `409` handling path for bed allocation race outcomes.
- [ ] Update client copy to explain when bed allocation fails due to concurrent assignment.
- [ ] Treat CHP care-plan writes as versioned records; read latest via `GET`.
- [ ] Re-test role-scoped access and error handling against current contracts.
- [ ] Re-run contract tests and portal smoke tests after client updates.

## Testing

- [Reception API Contract Tests](./testing/reception-contracts.md)


# AfyaHero Architecture Documentation

## Overview

AfyaHero is an AI-native Operating System for African hospitals, designed to scale to 100k+ facilities. It provides comprehensive hospital management across multiple portals (medical, pharmacy, laboratory, reception, admin, superadmin) with AI-powered diagnostics, teleconsultation, and analytics.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **ORM**: Prisma
- **Database**: PostgreSQL (Google Cloud SQL)
- **Authentication**: Supabase Auth
- **Caching**: Upstash Redis

### AI/ML
- **Providers**: HuggingFace, Groq, Vertex AI (Gemini), OpenAI, Claude
- **Cascade**: Automatic fallback between providers
- **Use Cases**: Diagnostics, Analytics, Drug Interaction, ICD-10, Inventory, Teleconsultation, Radiology/Pathology

### Development
- **Testing**: Jest, Playwright
- **Linting**: ESLint, TypeScript
- **Formatting**: Prettier
- **Git Hooks**: Husky
- **Package Manager**: npm

## Architecture Patterns

### Multi-Tenancy
- **Logical Sharding**: Data partitioned by `hospital_id`
- **Tenant Isolation**: All queries scoped to hospital context
- **Tenant Prisma Client**: `getTenantPrismaClient(hospitalId)` for scoped operations

### Layered Architecture
```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│  (React Components, Pages, Hooks)   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│          Application Layer           │
│     (API Routes, Business Logic)     │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│           Data Access Layer          │
│      (Prisma ORM, Repositories)     │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│           Database Layer             │
│    (PostgreSQL, Google Cloud SQL)   │
└─────────────────────────────────────┘
```

### Settings Architecture
- **Centralized Store**: Zustand with persistence middleware
- **Real-time Sync**: SSE-based updates with conflict resolution
- **Versioning**: History tracking with rollback capability
- **Import/Export**: JSON-based settings backup and sharing

## Portal Structure

### Medical Portal
- **Path**: `/portal/medical`
- **Role**: 'medical' (doctors, clinicians)
- **Key Features**: Patient management, consultations, clinical vitals, prescriptions
- **Settings**: Clinical preferences, notification settings, AI diagnostics configuration

### Pharmacy Portal
- **Path**: `/portal/pharmacy`
- **Role**: 'pharmacy'
- **Key Features**: Prescription dispensing, inventory management, drug interactions
- **Settings**: Dispensing preferences, inventory thresholds, insurance configuration

### Laboratory Portal
- **Path**: `/portal/laboratory`
- **Role**: 'laboratory'
- **Key Features**: Lab requests, quality incidents, equipment management
- **Settings**: Testing preferences, equipment calibration, reporting format

### Reception Portal
- **Path**: `/portal/reception`
- **Role**: 'reception'
- **Key Features**: Patient check-in, queue management, appointment scheduling
- **Settings**: Check-in preferences, queue assignment, appointment defaults

### Admin Portal
- **Path**: `/portal/admin`
- **Role**: 'admin'
- **Key Features**: Facility management, staffing, billing, user management
- **Settings**: Facility information, staffing policies, billing configuration

### Superadmin Portal
- **Path**: `/portal/superadmin`
- **Role**: 'superadmin'
- **Key Features**: System configuration, AI settings, security, compliance
- **Settings**: Feature flags, AI provider configuration, security policies, compliance settings

## Data Models

### Core Models
- **Hospital**: Facility information, location, license, accepted insurances
- **Profile**: Staff member information, role, department, hospital association
- **Patient**: Patient demographics, medical data, insurance information
- **Appointment**: Scheduled appointments with practitioners
- **LabRequest**: Laboratory test requests and results
- **Prescription**: Medication prescriptions and dispensing
- **ClinicalVital**: Patient vital signs and measurements
- **Consultation**: Doctor-patient consultation records
- **UserSettings**: Portal-specific user settings (JSON)
- **AuditLog**: System activity tracking
- **SecurityIncident**: Security breach documentation

### Compliance Models
- **DataBreachLog**: Data breach incident tracking
- **SecurityControl**: Security control implementation
- **RiskAssessment**: Risk assessment documentation
- **HealthDataExchange**: Inter-hospital data exchange
- **DataProtectionImpactAssessment**: GDPR compliance documentation

## API Architecture

### API Routes Structure
```
/api
├── /admin/*              # Admin operations
├── /ai/*                 # AI endpoints (DAWA, chat, diagnostics)
├── /fhir/*               # FHIR-compliant endpoints
├── /medical/*            # Medical portal APIs
├── /pharmacy/*           # Pharmacy portal APIs
├── /laboratory/*         # Laboratory portal APIs
├── /reception/*         # Reception portal APIs
├── /settings/*          # Settings persistence
├── /teleconsultation/*   # Teleconsultation APIs
└── /monitoring/*         # Health checks and metrics
```

### Authentication & Authorization
- **Auth Provider**: Supabase Auth
- **Session Management**: JWT tokens with refresh
- **Role-Based Access Control**: Profile roles determine access
- **API Security**: `enforceApiGuard` middleware for route protection
- **Rate Limiting**: Upstash Redis-based rate limiting

## AI Integration Architecture

### Provider Cascade
```
Request → HF → Groq → Vertex AI → OpenAI → Claude
          ↓      ↓        ↓          ↓        ↓
       Fallback → Fallback → Fallback → Fallback → Fallback
```

### AI Types
- **Diagnostic**: Medical diagnosis assistance
- **Analytics (DAWA)**: Data analytics and reporting
- **Drug Interaction**: Medication safety checks
- **ICD-10**: Medical coding suggestions
- **Inventory**: Stock optimization
- **Teleconsultation**: Video call analysis
- **Radiology/Pathology**: Medical image analysis

### AI Configuration
- **Timeout**: 15 seconds per provider
- **Fallback**: Automatic on failure
- **Logging**: All AI calls logged with context
- **Content Security**: CSP headers for AI-generated content

## Security Architecture

### Authentication
- **Provider**: Supabase Auth
- **Session**: JWT with refresh tokens
- **Multi-portal**: Session context includes portal role

### Authorization
- **Role-Based**: Profile roles determine access
- **Hospital-Scoped**: All operations scoped to hospital_id
- **API Guards**: `enforceApiGuard` middleware enforces auth

### Data Protection
- **Encryption**: At-rest and in-transit encryption
- **PII Redaction**: Logger automatically redacts sensitive data
- **Audit Logging**: All sensitive operations logged
- **Compliance**: GDPR and SHIF compliance built-in

### CSP Headers
- **AI Content**: Strict CSP for AI-generated content
- **Nonces**: Nonce-based CSP for dynamic content
- **Report-Only**: Development allows unsafe-inline

## Performance Optimization

### Caching Strategy
- **Redis**: Upstash Redis for rate limiting and session caching
- **Edge CDN**: Static assets cached at edge
- **Database**: Connection pooling, query optimization
- **Settings**: LocalStorage with server sync

### Database Optimization
- **Indexes**: Strategic indexes on frequently queried fields
- **Connection Pooling**: Prisma connection pooling
- **Query Optimization**: N+1 query prevention
- **Partitioning**: Logical sharding by hospital_id

### Frontend Optimization
- **Code Splitting**: Route-based code splitting
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Next.js Image component
- **Bundle Optimization**: Tree shaking, minification

## Monitoring & Observability

### Application Monitoring
- **Health Checks**: `/api/monitoring/health` endpoint
- **Metrics**: `/api/monitoring/metrics` endpoint
- **Performance Tracking**: Custom monitoring module
- **Error Tracking**: Centralized error logging
- **Alerting**: Rule-based alerting system

### Logging
- **Structured Logging**: JSON logs in production
- **Contextual**: Request ID, user ID, hospital ID
- **Sensitive Data**: Automatic redaction
- **Log Levels**: Debug, Info, Warn, Error

### Performance Metrics
- **Response Time**: API endpoint performance
- **Slow Operations**: Operations > 1 second tracked
- **Error Rate**: Error frequency monitoring
- **Database Health**: Connection and query performance

## Deployment Architecture

### Environment
- **Development**: Local development with hot reload
- **Staging**: Pre-production environment
- **Production**: Google Cloud SQL with high availability

### CI/CD
- **Git Hooks**: Pre-commit hooks enforce code quality
- **Automated Testing**: Jest + Playwright on every PR
- **Deployment**: Automated deployment to staging/production
- **Rollback**: One-click rollback capability

### Infrastructure
- **Database**: Google Cloud SQL PostgreSQL
- **Auth**: Supabase Auth
- **Caching**: Upstash Redis
- **Monitoring**: Custom monitoring endpoints

## Migration Strategy

### Database Migrations
- **Tool**: Prisma Migrate
- **Windows Support**: Node.js-based migration scripts (no psql required)
- **Rollback**: Migration rollback with version targeting
- **Status**: Migration status dashboard

### Schema Management
- **Version Control**: All schema changes in Prisma
- **Backward Compatibility**: Schema compat patches
- **Documentation**: Migration guide for team

## Development Workflow

### Code Quality
1. **Pre-commit**: Prettier, ESLint, TypeScript checks
2. **Testing**: Unit tests, integration tests, E2E tests
3. **Review**: Code review checklist enforcement
4. **Merge**: Automated deployment to staging

### Branching Strategy
- **Main**: Production-ready code
- **Feature**: Feature branches
- **Hotfix**: Urgent production fixes

### Testing
- **Unit Tests**: Jest for business logic
- **Integration Tests**: API route testing
- **E2E Tests**: Playwright for critical user flows
- **Coverage**: 80% target for critical modules

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: Next.js API routes are stateless
- **Database**: Connection pooling, read replicas
- **Caching**: Distributed Redis for session and rate limiting
- **Load Balancing**: CDN edge caching for static assets

### Vertical Scaling
- **Database**: Google Cloud SQL autoscaling
- **Application**: Kubernetes HPA for gateway
- **Monitoring**: Resource usage tracking

### Multi-Region
- **Database**: Regional database instances
- **CDN**: Global edge caching
- **Message Brokers**: Regional Kafka/RabbitMQ for inter-hospital sync

## Compliance

### GDPR
- **Data Retention**: Configurable retention policies
- **Right to be Forgotten**: Patient data deletion capability
- **Consent Management**: Data consent tracking
- **Audit Trails**: Complete audit logging

### SHIF (Social Health Insurance Fund)
- **Compliance**: SHIF number handling
- **Claims**: ShifClaim model for insurance claims
- **Validation**: SHIF-specific validation rules

### HIPAA (Future)
- **Encryption**: PHI encryption at rest and in transit
- **Access Logs**: Complete access logging
- **Risk Assessment**: Regular security assessments
- **Breach Response**: Data breach response procedures

## Documentation

- **Architecture**: This document
- **Database Migration**: `docs/DATABASE-MIGRATION-GUIDE.md`
- **Improvement Plan**: `docs/IMPROVEMENT-IMPLEMENTATION-PLAN.md`
- **Code Review Checklist**: `docs/CODE-REVIEW-CHECKLIST.md`
- **Project Rules**: `AGENTS.md`

## Support and Maintenance

### Issue Resolution
1. Check logs for error context
2. Review monitoring metrics
3. Check database health
4. Review recent deployments
5. Consult documentation

### Performance Issues
1. Check slow query logs
2. Review monitoring metrics
3. Check database connection pool
4. Review API response times
5. Check cache hit rates

### Security Incidents
1. Review security incident logs
2. Check audit logs for suspicious activity
3. Review rate limiting logs
4. Check for unauthorized access attempts
5. Follow incident response procedures

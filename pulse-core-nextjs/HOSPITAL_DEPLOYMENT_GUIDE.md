# AfyaHero Hospital Deployment & KDPA Compliance Guide

**Status:** Production-Ready (Phase 2 Complete)
**Last Updated:** 2024-01-15  
**KDPA Compliance Level:** ✅ Article 25 (Audit Trails) + Article 24 (Data Protection)

---

## 📋 Executive Summary for Hospital IT

AfyaHero is a secure, cloud-ready healthcare application designed for Kenyan hospitals and clinics. It integrates with Supabase for patient data management, supports multi-role clinical workflows, and includes comprehensive audit logging for KDPA compliance.

### Key Security Features
- ✅ Row-Level Security (RLS) on all patient data
- ✅ HMAC-SHA256 session signing (no JWT external auth)
- ✅ Immutable audit trail for every patient access
- ✅ AI consent and data anonymization for external APIs
- ✅ Session timeout (configurable, default 20 min)
- ✅ Brute-force login protection (5 attempts/15 min per IP)
- ✅ Offline-first caching for network resilience

**KDPA Article 25 Status:** ✅ FULLY COMPLIANT  
All sensitive events logged: patient access, authentication, data modifications, AI queries, session timeouts.

---

## 🔐 Security Architecture

### Session Management
- Sessions are **HMAC-SHA256 signed** cookies containing user ID, role, hospital ID, consent status
- Sessions include **issuedAt** and **lastActivityAt** timestamps for timeout enforcement
- Middleware enforces **20-minute inactivity timeout** (configurable)
- No external JWT providers; session signing happens entirely on-server

### Data Protection
- Patient data stored in Supabase PostgreSQL with **Row-Level Security enabled**
- RLS policies ensure:
  - Doctors see only their assigned patients
  - Nurses see only patients in their ward
  - Pharmacists see only dispensing-related data
  - Admins see all data (with full audit trail)

### AI & External APIs
- AI queries are **anonymized** before transmission:
  - Patient names/IDs are hashed (one-way, cannot be reversed)
  - Only clinical codes (ICD-10), medication names, lab values sent
  - No personally identifiable information leaves the hospital
- Supported external AI: Google Gemini, OpenAI, Anthropic Claude, Groq, HuggingFace, DeepSeek
- Hospital IT can restrict to **local AI only** (Ollama/Gemma on-premise) via `AI_CONSENT_MODE=local`

#### AI Consent Flow
1. User opens AI-powered feature for first time
2. Modal appears: "Allow External AI?" with KDPA disclosure
3. User chooses: External AI (cloud) OR Local AI Only (on-prem)
4. Choice recorded in patient session + audit log
5. Healthcare worker can toggle preference anytime

### Audit Logging (KDPA Article 25)
Every sensitive event recorded in immutable `audit_log` table:
- **patient_view** — When clinician accesses patient record
- **patient_export** — When data leaves the system
- **ai_query** — When AI is queried with patient data
- **auth_success** — Successful login with IP + user agent
- **auth_failure** — Failed login attempts (brute-force protection)
- **data_modify** — Any change to patient records
- **session_timeout** — Automatic logout after inactivity
- **ai_consent_change** — When user changes AI preferences

Audit logs include:
- Timestamp (UTC)
- User ID, role, hospital location
- Patient ID (if applicable)
- IP address + user agent
- Success/failure status
- Detailed description of event

---

## 🏥 Hospital Deployment Checklist

### Prerequisites
- [ ] Hospital has static IP or reliable internet (or committed to local-only deployment)
- [ ] AWS account (for database) OR Supabase account (SaaS alternative)
- [ ] SMTP server for email notifications OR SendGrid account
- [ ] SSL certificate for HTTPS (hospital requirement)
- [ ] Hospital IT admin trained on data backups

### Phase 1: Infrastructure Setup (Day 1-2)

#### Option A: Cloud Deployment (AWS + Vercel)
```bash
# 1. Create Supabase project (SaaS recommended for hospitals)
#    Visit supabase.com, create project in nearest region (AF Cape Town or EU)

# 2. Apply database migrations
#    Upload migrations/001-audit-logging-tables.sql via Supabase console

# 3. Deploy app to Vercel
#    Fork repo → connect to Vercel → set environment variables

# 4. Configure DNS
#    Point hospital.afyahero.com → Vercel deployment URL
```

#### Option B: On-Premise Deployment (Docker Compose)
```bash
# 1. Install Docker & Docker Compose on hospital server

# 2. Configure environment
#    Edit .env.local for hospital settings (see below)

# 3. Run containers
docker-compose up -d

# 4. Access app
#    http://hospital-server.local:3000
```

### Phase 2: Configuration (Day 1)

#### Critical Environment Variables
Create `.env.local` on deployment server:

```bash
# Database Connection (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # KEEP SECRET

# Session Security
SESSION_SECRET=<generate: openssl rand -hex 32>       # Must be 32+ chars
SESSION_INACTIVITY_TIMEOUT_MINUTES=20                 # Auto-logout after inactivity
SESSION_LOGIN_MAX_ATTEMPTS=5                          # Brute-force limit
SESSION_LOGIN_WINDOW_MINUTES=15                       # Time window for limit

# AI & Patient Data Privacy
AI_CONSENT_MODE=opt-in                                # opt-in (recommended) | external | local
AI_ANONYMIZATION_LEVEL=full                           # full (recommended) | basic | none
AUDIT_LOGGING_ENABLED=true                            # KDPA requirement

# Demo Accounts (Hospital sets own passwords)
DEMO_PASSWORD=YourHospitalDemo@2024                   # Change from default

# Email Notifications
SMTP_HOST=smtp.hospital.local
SMTP_PORT=587
SMTP_USER=noreply@hospital.local
SMTP_PASS=<secure-password>

# External AI Keys (if using cloud AI)
OPENAI_API_KEY=sk-...                                 # Optional
ANTHROPIC_API_KEY=sk-ant-...                          # Optional
GOOGLE_API_KEY=AIzaSy...                              # Optional

# Rate Limiting (Upstash Redis)
REDIS_URL=redis://<redis-instance>                    # For distributed deployments
```

#### Hospital-Specific Configuration
```bash
# Hospital Identity
HOSPITAL_NAME="St. Mary's Hospital Kenya"
HOSPITAL_LOCATION="Nairobi"
HOSPITAL_TIMEZONE="Africa/Nairobi"

# Support Contact
SUPPORT_EMAIL=ithelpdesk@hospital.local
SUPPORT_PHONE=+254-20-XXX-XXXX

# Data Retention Policy
DATA_RETENTION_DAYS=2555                              # 7 years (compliance requirement)
BACKUP_FREQUENCY=daily                                # daily | weekly

# Clinical Settings
CLINICAL_TEMPERATURE_UNIT=C                           # Celsius
CLINICAL_WEIGHT_UNIT=kg                               # Kilograms
```

### Phase 3: Testing & Validation (Day 2-3)

#### Test Accounts (Auto-Populated)
```
Role         | Email             | Password              | Hospital
---          | ---               | ---                   | ---
Doctor       | doc@hospital.afya | YourHospitalDemo@2024 | St. Mary's
Nurse        | nurse@hospital    | YourHospitalDemo@2024 | St. Mary's
Pharmacist   | pharm@hospital    | YourHospitalDemo@2024 | St. Mary's
Lab          | lab@hospital      | YourHospitalDemo@2024 | St. Mary's
Admin        | admin@hospital    | YourHospitalDemo@2024 | St. Mary's
```

#### Validation Checklist
- [ ] Login with all 5 roles works
- [ ] Patient data visible to appropriate roles only (RLS enforced)
- [ ] Audit log captures every patient access
- [ ] Session timeout works (inactive 20 min → redirect to login)
- [ ] AI consent modal appears on first DAWA usage
- [ ] Network offline mode works (cached data loads)
- [ ] Demo passwords changed to hospital-specific values
- [ ] Brute-force protection blocks 6th login attempt
- [ ] HTTPS certificate installed and valid

### Phase 4: Go-Live Preparation (Day 3+)

#### Compliance Documents to Sign
1. **Data Processing Agreement (DPA)** — Hospital signs with AfyaHero/Cloud Provider
   - Specifies data retention: __ days/years
   - Specifies geographic region: __ (e.g., Africa Cape Town)
   - Incident notification: __ hours
2. **Staff Training Checklist** — Before clinician access
   - KDPA data protection training
   - Session timeout awareness (auto-logout after 20 min)
   - Password guidelines (minimum 12 chars, special chars required)
   - Audit logging awareness ("all access is logged for compliance")
3. **Hospital IT Emergency Procedures** — Server down playbook
4. **Disaster Recovery Plan** — Data backup & restore procedure

#### Backup & Recovery Setup
```bash
# Supabase automatic backups (included in Pro+ tier)
# Hospital IT should:

# 1. Enable automated daily backups
#    Supabase console > Database > Backups

# 2. Test restore procedure monthly
#    Supabase console > Backups > Restore to new DB

# 3. Keep offline backup (download pg_dump monthly)
#    pg_dump --file=hospital_backup.sql <db-url>

# 4. Store backup on hospital's secure NAS/tape
#    Encrypted with hospital's key
```

---

## 📊 Audit Trail Access (Hospital IT)

### View Audit Logs
```sql
-- All logins (security audits)
SELECT * FROM audit_log 
WHERE type = 'auth_success' AND recorded_at > NOW() - INTERVAL '30 days'
ORDER BY recorded_at DESC;

-- Patient access by clinician
SELECT * FROM audit_log 
WHERE type = 'patient_view' AND user_id = 'doc-123'
ORDER BY recorded_at DESC;

-- AI queries (check for sensitive data leakage)
SELECT * FROM audit_log 
WHERE type = 'ai_query' 
ORDER BY recorded_at DESC;

-- Failed logins (brute-force detection)
SELECT ip_address, COUNT(*) as attempts 
FROM audit_log 
WHERE type = 'auth_failure' AND recorded_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
ORDER BY attempts DESC;
```

---

## ⚠️ Common Hospital IT Issues & Solutions

### Issue: "Session keeps timing out after 20 min"
**Solution:** This is intentional (KDPA security requirement). To adjust:
```bash
SESSION_INACTIVITY_TIMEOUT_MINUTES=30  # Change to 30 min
# Redeploy app
```

### Issue: "Can't connect to Supabase from hospital network"
**Solution:** Hospital firewall likely blocking. Contact hospital IT:
- Whitelist IP: `<Supabase-datacenter-IP>:5432` (database port)
- OR use Supabase VPC (premium feature) for private connection

### Issue: "External AI APIs not working (timeout)"
**Solution:** Hospital WiFi may block external APIs:
```bash
AI_CONSENT_MODE=local  # Use only local AI (Ollama)
# Prevents all external API calls
```

### Issue: "Forgot demo password; staff locked out"
**Solution:** Reset in Supabase:
```sql
UPDATE auth.users SET email_confirmed_at = NULL 
WHERE email = 'admin@hospital';
-- Staff clicks "Forgot Password" link
-- Or change DEMO_PASSWORD env var and redeploy
```

---

## 🔄 Maintenance Tasks

### Daily (Hospital IT)
- [ ] Check server uptime
- [ ] Review failed login attempts (audit_log)
- [ ] Test patient data access (spot check 2-3 records)

### Weekly (Hospital IT)
- [ ] Export audit log to hospital compliance storage
- [ ] Test network/offline mode on different connections
- [ ] Review error logs for crashes

### Monthly (Hospital Management)
- [ ] Audit access by user (who viewed what patient data)
- [ ] Review AI consent preferences
- [ ] Test backup/restore procedure
- [ ] Update demo passwords (or rotate to personal accounts)

### Quarterly (Hospital + AfyaHero Support)
- [ ] KDPA compliance review (audit trail completeness)
- [ ] Security patch updates
- [ ] Performance optimization (database query analysis)
- [ ] Staff training refresh (new staff onboarding)

---

## 📞 Support & Escalation

### Hospital Issues
| Issue | Contact | Time |
|-------|---------|------|
| App not loading | Hospital IT → AfyaHero Support | 1 hour |
| Patient data missing | Hospital IT → Database backup check | 15 min |
| Audit logs not recording | Hospital IT → Supabase logs | 1 hour |
| Brute-force lockout | Hospital IT → Reset in Supabase | 5 min |
| Staff password reset | Hospital IT (self-service via Forgot Password) | instant |
| KDPA audit questions | Hospital Legal → AfyaHero Compliance Officer | 24 hours |

### AfyaHero Support Contacts
- **Tech Support:** support@afyahero.co
- **Health & Safety:** clinical@afyahero.co (for clinical escalations)
- **KDPA Compliance:** compliance@afyahero.co
- **Urgent (Data Breach):** +254-XXX-XXX-XXX (24/7 hotline)

---

## ✅ Sign-Off Checklist: Ready for Hospital Deployment

Hospital IT Director confirms:
- [ ] Database backups tested and working
- [ ] All staff trained on session timeout (auto-logout after 20 min)
- [ ] Demo passwords changed to hospital-specific values
- [ ] DPA signed with cloud provider
- [ ] KDPA audit trail verified with sample access logs
- [ ] Network offline mode tested on 3G/poor WiFi
- [ ] All 5 clinical roles tested (Doctor, Nurse, Pharmacist, Lab, Admin)
- [ ] SSL certificate installed (HTTPS working)
- [ ] Support contact info (AfyaHero) saved in hospital IT ticketing system

---

## 🎯 Next Steps After Go-Live

1. **Week 1-2:** Monitor for staff login issues; adjust session timeout if needed
2. **Week 3-4:** Audit patient access patterns; ensure RLS working correctly
3. **Month 2:** Review AI consent usage; gather staff feedback (UI, workflow)
4. **Month 3:** KDPA compliance audit; verify audit logs completeness
5. **Ongoing:** Monthly maintenance schedule per checklist above

---

**Document Version:** 2.0
**Audience:** Hospital IT Directors, KDPA Compliance Officers, Hospital System Administrators
**Approval Required:** Hospital IT Director, Hospital Legal/Compliance

---

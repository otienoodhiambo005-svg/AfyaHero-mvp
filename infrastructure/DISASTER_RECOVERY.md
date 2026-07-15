# AfyaHero Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for the AfyaHero application infrastructure on Google Cloud Platform.

## Recovery Objectives

### Recovery Time Objective (RTO)
- **Critical Services**: 4 hours
- **Non-Critical Services**: 24 hours

### Recovery Point Objective (RPO)
- **Database**: 15 minutes (point-in-time recovery available)
- **Application State**: 1 hour
- **Static Assets**: 24 hours (versioning enabled)

## Architecture Redundancy

### High Availability Components

1. **Cloud SQL PostgreSQL**
   - Regional deployment with automatic failover
   - Automated backups every 15 minutes
   - Point-in-time recovery up to 7 days
   - Cross-region read replicas (optional)

2. **Redis (Memorystore)**
   - High-availability mode with automatic failover
   - Data persistence enabled
   - Cross-region replication (optional)

3. **GKE Cluster**
   - Regional cluster with multiple zones
   - Node auto-repair and auto-upgrade
   - Horizontal Pod Autoscaler
   - Pod Disruption Budgets

4. **Cloud Storage**
   - Multi-region redundancy
   - Versioning enabled for critical buckets
   - Cross-region replication (optional)

## Disaster Scenarios

### Scenario 1: Database Failure

**Severity**: Critical
**Impact**: Application cannot read/write data
**Recovery Time**: 1-2 hours

**Recovery Steps**:
1. Verify Cloud SQL instance health
2. Check Cloud SQL error logs
3. If instance is unresponsive:
   - Initiate failover to standby instance
   - Monitor failover progress
   - Verify application connectivity
4. If failover fails:
   - Restore from latest automated backup
   - Use point-in-time recovery if needed
   - Apply any missing transactions
5. Test application functionality
6. Document incident and root cause

**Prevention**:
- Enable automated backups
- Configure point-in-time recovery
- Monitor database health metrics
- Regular backup restoration drills

### Scenario 2: Redis Cache Failure

**Severity**: Medium
**Impact**: Degraded performance, session loss
**Recovery Time**: 30 minutes

**Recovery Steps**:
1. Verify Redis instance health
2. Check Redis error logs
3. If instance is unresponsive:
   - Redis HA will automatically failover to replica
   - Monitor failover progress
   - Verify application connectivity
4. If automatic failover fails:
   - Create new Redis instance
   - Update application configuration
   - Restart affected services
5. Monitor cache hit rates
6. Document incident

**Prevention**:
- Use HA mode with automatic failover
- Monitor Redis health metrics
- Implement cache warming strategies
- Regular failover testing

### Scenario 3: GKE Cluster Failure

**Severity**: Critical
**Impact**: Application completely unavailable
**Recovery Time**: 2-4 hours

**Recovery Steps**:
1. Verify cluster health
2. Check node status
3. If cluster is unresponsive:
   - Verify network connectivity
   - Check control plane logs
4. If cluster cannot be recovered:
   - Create new GKE cluster in same region
   - Deploy application manifests
   - Restore from backups (database, cache)
   - Update DNS records
5. Test application functionality
6. Monitor resource usage
7. Document incident

**Prevention**:
- Use regional clusters with multiple zones
- Enable node auto-repair
- Configure Pod Disruption Budgets
- Regular cluster health checks

### Scenario 4: Regional Outage

**Severity**: Critical
**Impact**: Complete service unavailability
**Recovery Time**: 4-8 hours

**Recovery Steps**:
1. Assess regional outage scope
2. Activate disaster recovery site (if available)
3. If no DR site:
   - Create infrastructure in alternate region
   - Restore database from cross-region backup
   - Deploy application
   - Update DNS to point to new region
4. Test application functionality
5. Monitor performance
6. Document incident and lessons learned

**Prevention**:
- Implement multi-region deployment
- Cross-region database replication
- Global DNS with health checks
- Regular DR drills

### Scenario 5: Data Corruption

**Severity**: Critical
**Impact**: Data integrity compromised
**Recovery Time**: 2-4 hours

**Recovery Steps**:
1. Identify corruption scope
2. Stop all write operations
3. Determine corruption timeline
4. Restore database to point before corruption
5. Verify data integrity
6. Re-apply valid transactions
7. Test application functionality
8. Investigate root cause
9. Document incident

**Prevention**:
- Enable database constraints and validation
- Regular data integrity checks
- Point-in-time recovery
- Application-level validation

## Backup Strategy

### Database Backups

- **Automated Backups**: Every 15 minutes, retained for 7 days
- **Manual Backups**: Before major changes, retained for 30 days
- **Cross-Region Backups**: Weekly, retained for 90 days

### Application Backups

- **Configuration**: Version controlled in Git
- **Static Assets**: Cloud Storage with versioning
- **Secrets**: Secret Manager with automatic replication

### Backup Verification

- Weekly backup integrity checks
- Monthly restoration drills
- Annual full disaster recovery test

## Communication Plan

### Internal Communication

1. **Detection**: Notify DevOps team
2. **Assessment**: Notify engineering leads
3. **Recovery**: Regular status updates
4. **Resolution**: Post-incident review

### External Communication

1. **Service Outage**: Notify users via status page
2. **Data Breach**: Follow security incident response
3. **Maintenance**: Advance notification for planned work

## Recovery Procedures

### Pre-Recovery Checklist

- [ ] Identify disaster scope and impact
- [ ] Activate incident response team
- [ ] Assign incident commander
- [ ] Set up communication channels
- [ ] Begin documentation

### Post-Recovery Checklist

- [ ] Verify all services operational
- [ ] Run smoke tests
- [ ] Monitor metrics for 24 hours
- [ ] Conduct post-incident review
- [ ] Update documentation
- [ ] Implement preventive measures

## Testing Schedule

### Monthly
- Backup integrity verification
- Failover procedure review

### Quarterly
- Database restoration drill
- Redis failover test
- GKE node failure simulation

### Annually
- Full disaster recovery drill
- Regional outage simulation
- DR plan update

## Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| Incident Commander | Coordinate response, make decisions |
| DevOps Engineer | Execute recovery procedures |
| Database Administrator | Database recovery operations |
| Security Engineer | Monitor for security issues |
| Communications Lead | Internal/external communication |
| Product Owner | Business impact assessment |

## Contact Information

### Emergency Contacts
- DevOps On-Call: [PHONE]
- Database Admin: [PHONE]
- Security Team: [PHONE]
- Management: [PHONE]

### External Support
- Google Cloud Support: [SUPPORT_URL]
- Cloud SQL Support: [SUPPORT_URL]
- Redis Support: [SUPPORT_URL]

## Documentation Updates

This DR plan should be reviewed and updated:
- After any incident
- Quarterly review of procedures
- Annual full review and update
- After infrastructure changes

## Related Documents

- [Infrastructure README](./terraform/README.md)
- [Security Incident Response Plan](./SECURITY_INCIDENT_RESPONSE.md)
- [Monitoring and Alerting Guide](./MONITORING.md)
- [Runbook Library](./RUNBOOKS/)

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-04-19 | 1.0 | Initial version | DevOps Team |

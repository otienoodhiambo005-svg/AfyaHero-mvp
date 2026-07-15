# AfyaHero Infrastructure as Code

This directory contains Terraform configurations for deploying the AfyaHero application infrastructure on Google Cloud Platform.

## Overview

The infrastructure includes:
- **VPC Network**: Private and public subnets with Cloud NAT for outbound internet access
- **Cloud SQL**: PostgreSQL 15 database with automated backups and point-in-time recovery
- **Redis (Memorystore)**: High-availability cache for session management and rate limiting
- **Cloud Storage**: Buckets for static assets and backups
- **Artifact Registry**: Docker image repository
- **IAM**: Service accounts with least-privilege access
- **Cloud Armor**: Security policies for DDoS protection and WAF
- **Cloud DNS**: Managed DNS zone
- **GKE Cluster**: Kubernetes cluster for containerized workloads (optional module)

## Prerequisites

- Terraform >= 1.5.0
- Google Cloud SDK (gcloud)
- Google Cloud project with appropriate APIs enabled
- Service account with Terraform permissions

## Setup Instructions

### 1. Configure Authentication

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  dns.googleapis.com \
  container.googleapis.com \
  cloudbuild.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com
```

### 3. Create Terraform State Bucket

```bash
gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://afyahero-terraform-state
```

### 4. Configure Variables

Copy the example variables file and fill in your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your actual values:
- `project_id`: Your Google Cloud project ID
- `region`: Desired region (e.g., us-central1)
- `domain_name`: Your domain name
- `db_password`: Secure password for the database

### 5. Initialize Terraform

```bash
terraform init
```

### 6. Plan and Apply

```bash
terraform plan
terraform apply
```

## Module Structure

```
infrastructure/terraform/
├── main.tf              # Main infrastructure configuration
├── variables.tf         # Variable definitions
├── outputs.tf           # Output definitions
├── terraform.tfvars.example  # Example variables
├── modules/
│   └── gke/            # GKE cluster module (optional)
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── README.md
```

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_id` | Google Cloud Project ID | Required |
| `region` | Google Cloud Region | us-central1 |
| `domain_name` | Domain name for the application | Required |
| `db_password` | Cloud SQL database password | Required |
| `environment` | Environment name | production |
| `enable_monitoring` | Enable Cloud Monitoring | true |
| `enable_logging` | Enable Cloud Logging | true |
| `max_db_connections` | Maximum database connections | 200 |
| `redis_memory_gb` | Redis instance memory size in GB | 2 |

## Outputs

After applying the Terraform configuration, the following outputs will be available:

- `project_id`: Google Cloud Project ID
- `region`: Google Cloud Region
- `vpc_network`: VPC Network name
- `cloud_sql_instance_name`: Cloud SQL instance connection name
- `cloud_sql_instance_ip`: Cloud SQL instance private IP
- `redis_host`: Redis instance host
- `redis_port`: Redis instance port
- `static_assets_bucket`: Static assets bucket name
- `backups_bucket`: Backups bucket name
- `docker_repository`: Docker repository ID
- `service_account_email`: Application service account email
- `security_policy_name`: Cloud Armor security policy name
- `dns_zone_name`: Cloud DNS managed zone name

## Security Considerations

- All resources use private networks where possible
- Cloud SQL is configured with private IP only
- Service accounts use least-privilege IAM roles
- Cloud Armor provides DDoS protection and WAF rules
- Database backups are enabled with 7-day retention
- All secrets should be stored in Secret Manager (not in terraform.tfvars)

## Cost Estimation

Estimated monthly costs (us-central1 region):

- Cloud SQL (db-custom-2-3840): ~$150-200/month
- Redis (2GB, HA): ~$80-100/month
- Cloud Storage: ~$0.02/GB/month
- Artifact Registry: ~$0.10/GB/month
- VPC and networking: Minimal (<$10/month)
- GKE (if used): $50-200/month depending on usage

Total estimated cost: ~$300-600/month for production infrastructure.

## Disaster Recovery

- Cloud SQL: Automated backups with point-in-time recovery
- Cloud Storage: Versioning enabled for buckets
- Redis: High-availability configuration with automatic failover
- GKE: Regional cluster with node auto-repair and auto-upgrade

See `DISASTER_RECOVERY.md` for detailed disaster recovery procedures.

## Maintenance

### Database Maintenance

Cloud SQL performs automatic maintenance during the maintenance window. Monitor for any issues during this time.

### Redis Maintenance

Memorystore performs maintenance during the configured weekly window (Sunday 2:00 AM UTC).

### Terraform Updates

When updating infrastructure:
1. Review changes with `terraform plan`
2. Test in staging environment first
3. Apply during maintenance window if possible
4. Monitor for issues after deployment

## Troubleshooting

### Terraform State Lock Issues

If you encounter state lock issues:
```bash
terraform force-unlock <LOCK_ID>
```

### Resource Deletion Protection

Some resources have deletion protection enabled. To delete:
```bash
terraform destroy -target=<resource_name>
```

### Access Issues

If you encounter permission issues:
1. Verify service account has correct IAM roles
2. Check project-level permissions
3. Ensure APIs are enabled

## Support

For infrastructure issues:
1. Check Cloud Logging for error messages
2. Review Terraform state with `terraform show`
3. Consult Google Cloud documentation
4. Contact DevOps team for assistance

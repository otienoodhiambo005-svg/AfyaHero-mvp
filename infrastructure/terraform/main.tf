# AfyaHero Infrastructure - Terraform Configuration
# Provider: Google Cloud Platform

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  backend "gcs" {
    bucket = "afyahero-terraform-state"
    prefix = "production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Random suffix for resource naming to avoid conflicts
resource "random_id" "suffix" {
  byte_length = 4
}

# VPC Network
resource "google_compute_network" "main" {
  name                    = "afyahero-vpc-${random_id.suffix.hex}"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# Subnets
resource "google_compute_subnetwork" "private" {
  name          = "afyahero-private-subnet-${random_id.suffix.hex}"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.main.id
  
  private_ip_google_access = true
  
  secondary_ip_range {
    range_name    = "pods-range"
    ip_cidr_range = "10.0.64.0/24"
  }
  
  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "10.0.65.0/24"
  }
}

resource "google_compute_subnetwork" "public" {
  name          = "afyahero-public-subnet-${random_id.suffix.hex}"
  ip_cidr_range = "10.0.2.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

# Cloud Router for NAT
resource "google_compute_router" "router" {
  name    = "afyahero-router-${random_id.suffix.hex}"
  region  = var.region
  network = google_compute_network.main.id
}

# Cloud NAT
resource "google_compute_router_nat" "nat" {
  name                               = "afyahero-nat-${random_id.suffix.hex}"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = ["ALL_SUBNETWORKS_ALL_IP_RANGES"]
  
  log_config {
    enable = true
    filter = "ALL"
  }
}

# Cloud SQL for PostgreSQL
resource "google_sql_database_instance" "main" {
  name             = "afyahero-db-${random_id.suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier              = "db-custom-2-3840"
    disk_autoresize   = true
    disk_size         = 100
    disk_type         = "PD_SSD"
    availability_type = "REGIONAL"
    
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
      require_ssl     = true
      
      authorized_networks {
        name  = "private-subnet"
        value = google_compute_subnetwork.private.ip_cidr_range
      }
    }
    
    location_preference {
      zone = "${var.region}-a"
    }
  }
  
  deletion_protection = false
}

resource "google_sql_database" "afyahero" {
  name     = "afyahero"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app_user" {
  name     = "afyahero_app"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# Redis (Memorystore) - Alternative to Upstash
resource "google_redis_instance" "cache" {
  name           = "afyahero-cache-${random_id.suffix.hex}"
  tier           = "STANDARD_HA"
  memory_size_gb = 2
  region         = var.region
  
  redis_version       = "7.2"
  display_name        = "AfyaHero Cache"
  authorized_network  = google_compute_network.main.id
  
  redis_configs {
    maxmemory_policy = "allkeys-lru"
  }
  
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
      }
    }
  }
}

# Cloud Storage for static assets
resource "google_storage_bucket" "static_assets" {
  name          = "afyahero-static-assets-${random_id.suffix.hex}"
  location      = var.region
  force_destroy = false
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Cloud Storage for backups
resource "google_storage_bucket" "backups" {
  name          = "afyahero-backups-${random_id.suffix.hex}"
  location      = var.region
  force_destroy = false
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "afyahero-docker"
  description   = "Docker repository for AfyaHero application"
  format        = "DOCKER"
}

# IAM Service Accounts
resource "google_service_account" "app" {
  account_id   = "afyahero-app-${random_id.suffix.hex}"
  display_name = "AfyaHero Application Service Account"
}

resource "google_project_iam_member" "app_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_storage_object_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_redis_user" {
  project = var.project_id
  role    = "roles/redis.user"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_monitoring_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.app.email}"
}

# Cloud Armor Security Policy
resource "google_compute_security_policy" "security_policy" {
  name        = "afyahero-security-policy-${random_id.suffix.hex}"
  description = "Security policy for AfyaHero application"
  
  rule {
    action      = "deny(403)"
    description = "Deny SQL injection attempts"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-stable')"
      }
      versioned_expr {
        preview_config {
          enabled = true
        }
      }
    }
    priority = 1000
  }
  
  rule {
    action      = "deny(403)"
    description = "Deny XSS attempts"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-stable')"
      }
    }
    priority = 1001
  }
  
  rule {
    action      = "rate_based_ban"
    description = "Rate limit: 1000 requests per 60 seconds"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('cve-canary')"
      }
    }
    priority = 2147483647
    rate_limit_options {
      conform_action            = "allow"
      exceed_action              = "ban(60s)"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
      enforce_on_key             = "IP"
    }
  }
}

# Cloud DNS
resource "google_dns_managed_zone" "main" {
  name        = "afyahero-zone-${random_id.suffix.hex}"
  dns_name    = var.domain_name
  description = "Managed DNS zone for AfyaHero"
}

# Outputs
output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "vpc_network" {
  value = google_compute_network.main.name
}

output "cloud_sql_instance_name" {
  value     = google_sql_database_instance.main.connection_name
  sensitive = true
}

output "cloud_sql_instance_ip" {
  value     = google_compute_sql_database_instance.main.private_ip_address
  sensitive = true
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "redis_port" {
  value = google_redis_instance.cache.port
}

output "static_assets_bucket" {
  value = google_storage_bucket.static_assets.name
}

output "backups_bucket" {
  value = google_storage_bucket.backups.name
}

output "docker_repository" {
  value = google_artifact_registry_repository.docker.id
}

output "service_account_email" {
  value = google_service_account.app.email
}

output "security_policy_name" {
  value = google_compute_security_policy.security_policy.name
}

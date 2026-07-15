# Outputs for AfyaHero Infrastructure

output "project_id" {
  description = "Google Cloud Project ID"
  value       = var.project_id
}

output "region" {
  description = "Google Cloud Region"
  value       = var.region
}

output "vpc_network" {
  description = "VPC Network name"
  value       = google_compute_network.main.name
}

output "vpc_network_id" {
  description = "VPC Network ID"
  value       = google_compute_network.main.id
}

output "private_subnet" {
  description = "Private subnet name"
  value       = google_compute_subnetwork.private.name
}

output "private_subnet_cidr" {
  description = "Private subnet CIDR range"
  value       = google_compute_subnetwork.private.ip_cidr_range
}

output "public_subnet" {
  description = "Public subnet name"
  value       = google_compute_subnetwork.public.name
}

output "public_subnet_cidr" {
  description = "Public subnet CIDR range"
  value       = google_compute_subnetwork.public.ip_cidr_range
}

output "cloud_sql_instance_name" {
  description     = "Cloud SQL instance connection name"
  value           = google_sql_database_instance.main.connection_name
  sensitive       = true
}

output "cloud_sql_instance_ip" {
  description     = "Cloud SQL instance private IP address"
  value           = google_compute_sql_database_instance.main.private_ip_address
  sensitive       = true
}

output "cloud_sql_database_name" {
  description = "Cloud SQL database name"
  value       = google_sql_database.afyahero.name
}

output "cloud_sql_user_name" {
  description = "Cloud SQL database user name"
  value       = google_sql_user.app_user.name
  sensitive   = true
}

output "redis_host" {
  description = "Redis instance host"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Redis instance port"
  value       = google_redis_instance.cache.port
}

output "static_assets_bucket" {
  description = "Static assets Cloud Storage bucket name"
  value       = google_storage_bucket.static_assets.name
}

output "static_assets_bucket_url" {
  description = "Static assets Cloud Storage bucket URL"
  value       = google_storage_bucket.static_assets.url
}

output "backups_bucket" {
  description = "Backups Cloud Storage bucket name"
  value       = google_storage_bucket.backups.name
}

output "backups_bucket_url" {
  description = "Backups Cloud Storage bucket URL"
  value       = google_storage_bucket.backups.url
}

output "docker_repository" {
  description = "Docker Artifact Registry repository ID"
  value       = google_artifact_registry_repository.docker.id
}

output "docker_repository_location" {
  description = "Docker Artifact Registry repository location"
  value       = google_artifact_registry_repository.docker.location
}

output "service_account_email" {
  description = "Application service account email"
  value       = google_service_account.app.email
}

output "service_account_name" {
  description = "Application service account name"
  value       = google_service_account.app.account_id
}

output "security_policy_name" {
  description = "Cloud Armor security policy name"
  value       = google_compute_security_policy.security_policy.name
}

output "dns_zone_name" {
  description = "Cloud DNS managed zone name"
  value       = google_dns_managed_zone.main.name
}

output "dns_zone_dns_name" {
  description = "Cloud DNS managed zone DNS name"
  value       = google_dns_managed_zone.main.dns_name
}

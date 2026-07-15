# Variables for GKE Cluster Module

variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "location" {
  description = "GKE cluster location (region or zone)"
  type        = string
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "afyahero-gke"
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "subnetwork_id" {
  description = "Subnetwork ID for the cluster"
  type        = string
}

variable "pods_range_name" {
  description = "Secondary IP range name for pods"
  type        = string
  default     = "pods-range"
}

variable "services_range_name" {
  description = "Secondary IP range name for services"
  type        = string
  default     = "services-range"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "service_account_email" {
  description = "Service account email for node pools"
  type        = string
}

# Application Node Pool Variables
variable "app_node_count" {
  description = "Initial number of application nodes"
  type        = number
  default     = 2
}

variable "app_machine_type" {
  description = "Machine type for application nodes"
  type        = string
  default     = "e2-medium"
}

variable "app_min_nodes" {
  description = "Minimum number of application nodes for autoscaling"
  type        = number
  default     = 1
}

variable "app_max_nodes" {
  description = "Maximum number of application nodes for autoscaling"
  type        = number
  default     = 10
}

# Gateway Node Pool Variables
variable "gateway_node_count" {
  description = "Initial number of gateway nodes"
  type        = number
  default     = 1
}

variable "gateway_machine_type" {
  description = "Machine type for gateway nodes"
  type        = string
  default     = "e2-small"
}

variable "gateway_min_nodes" {
  description = "Minimum number of gateway nodes for autoscaling"
  type        = number
  default     = 1
}

variable "gateway_max_nodes" {
  description = "Maximum number of gateway nodes for autoscaling"
  type        = number
  default     = 5
}

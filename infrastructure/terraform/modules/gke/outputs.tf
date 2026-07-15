# Outputs for GKE Cluster Module

output "cluster_name" {
  description = "Name of the GKE cluster"
  value       = google_container_cluster.primary.name
}

output "cluster_id" {
  description = "ID of the GKE cluster"
  value       = google_container_cluster.primary.id
}

output "cluster_endpoint" {
  description     = "Endpoint of the GKE cluster"
  value           = google_container_cluster.primary.endpoint
  sensitive       = true
}

output "cluster_ca_certificate" {
  description     = "CA certificate of the GKE cluster"
  value           = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive       = true
}

output "cluster_location" {
  description = "Location of the GKE cluster"
  value       = google_container_cluster.primary.location
}

output "app_node_pool_name" {
  description = "Name of the application node pool"
  value       = google_container_node_pool.app_nodes.name
}

output "app_node_pool_count" {
  description = "Number of application nodes"
  value       = google_container_node_pool.app_nodes.node_count
}

output "gateway_node_pool_name" {
  description = "Name of the gateway node pool"
  value       = google_container_node_pool.gateway_nodes.name
}

output "gateway_node_pool_count" {
  description = "Number of gateway nodes"
  value       = google_container_node_pool.gateway_nodes.node_count
}

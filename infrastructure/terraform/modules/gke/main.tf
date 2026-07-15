# GKE Cluster Module for AfyaHero

resource "google_container_cluster" "primary" {
  name     = "${var.cluster_name}-${random_id.suffix.hex}"
  location = var.location
  
  remove_default_node_pool = true
  initial_node_count       = 1
  
  network    = var.network_id
  subnetwork = var.subnetwork_id
  
  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }
  
  private_cluster_config {
    enable_private_endpoint = false
    enable_private_nodes    = true
    master_ipv4_cidr_block  = "10.0.0.0/28"
  }
  
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks"
    }
  }
  
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    istio_config {
      disabled = true
    }
    cloudrun_config {
      disabled = true
    }
    dns_cache_config {
      disabled = true
    }
  }
  
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  
  resource_labels = {
    environment = var.environment
    application = "afyahero"
  }
  
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

# Node Pool for Application Workloads
resource "google_container_node_pool" "app_nodes" {
  name       = "app-node-pool"
  location   = google_container_cluster.primary.location
  cluster    = google_container_cluster.primary.name
  node_count = var.app_node_count
  
  node_config {
    machine_type = var.app_machine_type
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
    
    service_account = var.service_account_email
    
    labels = {
      nodepool = "app"
      workload = "application"
    }
    
    taint {
      key    = "workload"
      value  = "application"
      effect = "NO_SCHEDULE"
    }
  }
  
  autoscaling {
    min_node_count = var.app_min_nodes
    max_node_count = var.app_max_nodes
  }
  
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Node Pool for Gateway Workloads
resource "google_container_node_pool" "gateway_nodes" {
  name       = "gateway-node-pool"
  location   = google_container_cluster.primary.location
  cluster    = google_container_cluster.primary.name
  node_count = var.gateway_node_count
  
  node_config {
    machine_type = var.gateway_machine_type
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
    
    service_account = var.service_account_email
    
    labels = {
      nodepool = "gateway"
      workload = "gateway"
    }
    
    taint {
      key    = "workload"
      value  = "gateway"
      effect = "NO_SCHEDULE"
    }
  }
  
  autoscaling {
    min_node_count = var.gateway_min_nodes
    max_node_count = var.gateway_max_nodes
  }
  
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

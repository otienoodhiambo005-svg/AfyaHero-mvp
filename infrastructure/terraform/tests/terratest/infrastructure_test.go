// Infrastructure Tests for AfyaHero Terraform Configuration
package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/gruntwork-io/terratest/modules/test-structure"
	"github.com/stretchr/testify/assert"
)

func TestInfrastructure(t *testing.T) {
	t.Parallel()

	// Get the Terraform directory
	terraformDir := test_structure.CopyTerraformFolderToTempDir(t, "..", "..")

	// Configure Terraform options
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: terraformDir,
		Vars: map[string]interface{}{
			"project_id":  "test-project",
			"region":      "us-central1",
			"domain_name": "test.afyahero.example.com",
			"db_password": "test-password-123",
			"environment": "test",
		},
	})

	// Cleanup at the end of the test
	defer terraform.Destroy(t, terraformOptions)

	// Run terraform init and apply
	terraform.InitAndApply(t, terraformOptions)

	// Run tests
	t.Run("VPCNetworkExists", func(t *testing.T) {
		vpcName := terraform.Output(t, terraformOptions, "vpc_network")
		assert.NotEmpty(t, vpcName)
		assert.Contains(t, vpcName, "afyahero-vpc")
	})

	t.Run("CloudSQLInstanceExists", func(t *testing.T) {
		instanceName := terraform.Output(t, terraformOptions, "cloud_sql_instance_name")
		assert.NotEmpty(t, instanceName)
		assert.Contains(t, instanceName, "afyahero-db")
	})

	t.Run("RedisInstanceExists", func(t *testing.T) {
		redisHost := terraform.Output(t, terraformOptions, "redis_host")
		redisPort := terraform.Output(t, terraformOptions, "redis_port")
		assert.NotEmpty(t, redisHost)
		assert.NotEmpty(t, redisPort)
		assert.Equal(t, "6379", redisPort)
	})

	t.Run("StorageBucketsExist", func(t *testing.T) {
		staticBucket := terraform.Output(t, terraformOptions, "static_assets_bucket")
		backupsBucket := terraform.Output(t, terraformOptions, "backups_bucket")
		assert.NotEmpty(t, staticBucket)
		assert.NotEmpty(t, backupsBucket)
		assert.Contains(t, staticBucket, "static-assets")
		assert.Contains(t, backupsBucket, "backups")
	})

	t.Run("ArtifactRegistryExists", func(t *testing.T) {
		repo := terraform.Output(t, terraformOptions, "docker_repository")
		assert.NotEmpty(t, repo)
		assert.Contains(t, repo, "afyahero-docker")
	})

	t.Run("ServiceAccountExists", func(t *testing.T) {
		saEmail := terraform.Output(t, terraformOptions, "service_account_email")
		assert.NotEmpty(t, saEmail)
		assert.Contains(t, saEmail, "afyahero-app")
		assert.Contains(t, saEmail, ".iam.gserviceaccount.com")
	})

	t.Run("SecurityPolicyExists", func(t *testing.T) {
		policyName := terraform.Output(t, terraformOptions, "security_policy_name")
		assert.NotEmpty(t, policyName)
		assert.Contains(t, policyName, "security-policy")
	})

	t.Run("DNSZoneExists", func(t *testing.T) {
		zoneName := terraform.Output(t, terraformOptions, "dns_zone_name")
		dnsName := terraform.Output(t, terraformOptions, "dns_zone_dns_name")
		assert.NotEmpty(t, zoneName)
		assert.NotEmpty(t, dnsName)
		assert.Contains(t, zoneName, "afyahero-zone")
	})
}

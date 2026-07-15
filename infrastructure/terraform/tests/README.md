# Infrastructure Testing

This directory contains infrastructure tests for the Terraform configuration using Terratest.

## Prerequisites

- Go 1.21 or higher
- Terraform 1.5.0 or higher
- Google Cloud SDK
- Test Google Cloud project

## Setup

### Install Terratest

```bash
go install github.com/gruntwork-io/terratest/modules/terraform@latest
```

### Initialize Go Module

```bash
cd tests/terratest
go mod init afyahero-infrastructure-tests
go mod tidy
```

## Running Tests

### Run All Tests

```bash
cd tests/terratest
go test -v -timeout 30m
```

### Run Specific Test

```bash
cd tests/terratest
go test -v -run TestInfrastructure
```

### Run Tests with Retry

```bash
cd tests/terratest
go test -v -timeout 60m -retry
```

## Test Coverage

The current test suite covers:

- VPC Network creation and configuration
- Cloud SQL instance deployment
- Redis cache instance creation
- Cloud Storage buckets for static assets and backups
- Artifact Registry for Docker images
- IAM service account creation
- Cloud Armor security policies
- Cloud DNS managed zones

## Adding New Tests

To add a new test, create a new test function in `infrastructure_test.go`:

```go
func TestNewFeature(t *testing.T) {
    t.Parallel()
    
    terraformDir := test_structure.CopyTerraformFolderToTempDir(t, "..", "..")
    
    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: terraformDir,
        Vars: map[string]interface{}{
            // Test variables
        },
    })
    
    defer terraform.Destroy(t, terraformOptions)
    
    terraform.InitAndApply(t, terraformOptions)
    
    // Add assertions
    assert.Equal(t, expected, actual)
}
```

## Test Variables

Tests use a separate test project to avoid affecting production resources. Configure test variables in the test function:

```go
Vars: map[string]interface{}{
    "project_id":  "your-test-project",
    "region":      "us-central1",
    "domain_name": "test.afyahero.example.com",
    "db_password": "test-password",
    "environment": "test",
}
```

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
- name: Run Infrastructure Tests
  run: |
    cd infrastructure/terraform/tests/terratest
    go test -v -timeout 60m
```

## Troubleshooting

### Test Timeout

If tests timeout due to resource creation time, increase the timeout:

```bash
go test -v -timeout 90m
```

### Authentication Issues

Ensure Google Cloud authentication is configured:

```bash
gcloud auth login
gcloud config set project YOUR_TEST_PROJECT
```

### Resource Cleanup

If tests fail and resources are not cleaned up, manually destroy:

```bash
cd infrastructure/terraform
terraform destroy
```

## Best Practices

1. Use parallel tests where possible (`t.Parallel()`)
2. Clean up resources after each test (`defer terraform.Destroy`)
3. Use test-specific projects and environments
4. Mock external dependencies where possible
5. Test both success and failure scenarios
6. Keep tests fast and focused

## Security Considerations

- Never commit test credentials
- Use service accounts with minimal permissions for tests
- Rotate test credentials regularly
- Clean up test resources after completion
- Monitor test project for unexpected charges

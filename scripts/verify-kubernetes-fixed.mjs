#!/usr/bin/env node

/**
 * Kubernetes Deployment Verification Script
 * 
 * ✅ FIXED: Removed TypeScript interfaces, converted to pure JavaScript
 * ✅ ENHANCED: Added proper error handling, exit codes, and audit reporting
 * 
 * Validates that:
 * 1. All K8s manifest files are syntactically valid
 * 2. Configuration covers all required components
 * 3. Container health checks are properly configured
 * 4. Scaling configuration is optimized
 * 5. RBAC and security policies are in place
 * 6. Monitoring and logging are configured
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

const results = [];
let passedCount = 0;
let totalCount = 0;

function addResult(name, passed, details, severity = 'info') {
  totalCount++;
  if (passed) passedCount++;

  results.push({ name, passed, details, severity });

  const icon = passed ? '✅' : severity === 'error' ? '❌' : '⚠️';
  const color =
    passed ? chalk.green : severity === 'error' ? chalk.red : chalk.yellow;

  console.log(`${icon} ${color(name)}: ${details}`);
}

async function verifyOK(passed, name, successMsg, failureMsg) {
  addResult(
    name,
    passed,
    passed ? successMsg : failureMsg,
    passed ? 'info' : 'error'
  );
}

async function checkFile(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function parseYamlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const docs = content
    .split('---')
    .filter((doc) => doc.trim())
    .map((doc) => {
      try {
        return parseYaml(doc);
      } catch (e) {
        return null;
      }
    });
  return docs.filter(Boolean);
}

async function verifyK8sManifests() {
  console.log(chalk.bold.cyan('\n📋 Kubernetes Manifests\n'));

  const manifests = [
    'k8s/01-namespace.yaml',
    'k8s/02-configmap.yaml',
    'k8s/03-secrets.yaml',
    'k8s/04-deployment.yaml',
    'k8s/05-service.yaml',
    'k8s/06-hpa.yaml',
    'k8s/07-ingress.yaml',
    'k8s/08-rbac.yaml',
    'k8s/09-monitoring.yaml',
  ];

  for (const manifest of manifests) {
    const exists = await checkFile(manifest);
    await verifyOK(
      exists,
      `${path.basename(manifest)}`,
      'File exists',
      'File not found'
    );

    if (exists) {
      try {
        const docs = await parseYamlFile(manifest);
        await verifyOK(
          docs.length > 0,
          `  └─ YAML syntax`,
          `Valid (${docs.length} resource${docs.length !== 1 ? 's' : ''})`,
          'Invalid YAML'
        );
      } catch (e) {
        await verifyOK(false, `  └─ YAML syntax`, '', 'Parse error');
      }
    }
  }
}

async function verifyNamespace() {
  console.log(chalk.bold.cyan('\n🏗️ Namespace Configuration\n'));

  try {
    const docs = await parseYamlFile('k8s/01-namespace.yaml');
    const namespace = docs.find((d) => d.kind === 'Namespace');

    await verifyOK(
      namespace && namespace.metadata.name === 'afyahero',
      'Namespace name',
      'Named "afyahero"',
      'Incorrect namespace'
    );
  } catch (e) {
    await verifyOK(false, 'Namespace validation', '', 'Failed to parse');
  }
}

async function verifyConfigMap() {
  console.log(chalk.bold.cyan('\n⚙️ Configuration Management\n'));

  try {
    const docs = await parseYamlFile('k8s/02-configmap.yaml');
    const configmap = docs.find((d) => d.kind === 'ConfigMap');

    const requiredKeys = [
      'NODE_ENV',
      'FHIR_VERSION',
      'ENABLE_IMAGE_OPTIMIZATION',
      'DATABASE_POOL_SIZE',
      'CACHE_TTL',
      'LOG_LEVEL',
    ];

    const hasAllKeys = requiredKeys.every(
      (key) => configmap.data && key in configmap.data
    );

    await verifyOK(
      hasAllKeys,
      'ConfigMap keys',
      `All ${requiredKeys.length} required keys present`,
      `Missing keys: ${requiredKeys.filter((k) => !configmap.data[k]).join(', ')}`
    );

    const keyCount = Object.keys(configmap.data || {}).length;
    await verifyOK(
      keyCount >= 30,
      'Configuration coverage',
      `${keyCount} configuration parameters`,
      `Only ${keyCount} parameters (need at least 30)`
    );
  } catch (e) {
    await verifyOK(false, 'ConfigMap validation', '', 'Failed to parse');
  }
}

async function verifySecrets() {
  console.log(chalk.bold.cyan('\n🔐 Secrets Management\n'));

  try {
    const docs = await parseYamlFile('k8s/03-secrets.yaml');
    const secret = docs.find((d) => d.kind === 'Secret');

    const requiredSecrets = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'JWT_SECRET',
      'NEXTAUTH_SECRET',
    ];

    await verifyOK(
      secret && secret.type === 'Opaque',
      'Secret type',
      'Correctly set to Opaque',
      'Invalid type'
    );

    const secretCount = Object.keys(secret.data || {}).length;
    await verifyOK(
      secretCount >= 15,
      'Secret coverage',
      `${secretCount} secrets defined`,
      `Only ${secretCount} secrets (need at least 15)`
    );
  } catch (e) {
    await verifyOK(false, 'Secret validation', '', 'Failed to parse');
  }
}

async function verifyDeployment() {
  console.log(chalk.bold.cyan('\n🚀 Deployment Configuration\n'));

  try {
    const docs = await parseYamlFile('k8s/04-deployment.yaml');
    const deployment = docs.find((d) => d.kind === 'Deployment');
    const pdb = docs.find((d) => d.kind === 'PodDisruptionBudget');

    // Check replicas
    const replicas = deployment.spec.replicas || 0;
    await verifyOK(
      replicas >= 3,
      'Initial replicas',
      `${replicas} replicas (high availability)`,
      `Only ${replicas} replicas (need at least 3)`
    );

    // Check resource limits
    const spec = deployment.spec.template.spec.containers[0];
    const hasResourceLimits =
      spec.resources?.limits?.cpu && spec.resources?.limits?.memory;
    await verifyOK(
      hasResourceLimits,
      'Resource limits',
      `CPU: ${spec.resources?.limits?.cpu}, Memory: ${spec.resources?.limits?.memory}`,
      'No resource limits defined'
    );

    // Check probes
    const hasLiveness = !!spec.livenessProbe;
    const hasReadiness = !!spec.readinessProbe;
    const hasStartup = !!spec.startupProbe;

    await verifyOK(
      hasLiveness && hasReadiness && hasStartup,
      'Health probes',
      'Liveness + Readiness + Startup configured',
      `Missing: ${[!hasLiveness && 'Liveness', !hasReadiness && 'Readiness', !hasStartup && 'Startup'].filter(Boolean).join(', ')}`
    );

    // Check security context
    const securityContext = spec.securityContext;
    const isSafe =
      securityContext?.runAsNonRoot === true &&
      securityContext?.readOnlyRootFilesystem === true;

    await verifyOK(
      isSafe,
      'Security hardening',
      'Non-root user + read-only filesystem enabled',
      'Security context insufficient'
    );

    // Check graceful shutdown
    const preStopHook = spec.lifecycle?.preStop;
    await verifyOK(
      preStopHook,
      'Graceful shutdown',
      'PreStop hook configured',
      'No PreStop hook'
    );

    // Check PDB
    await verifyOK(
      pdb && pdb.spec.minAvailable >= 1,
      'Pod Disruption Budget',
      `minAvailable: ${pdb?.spec?.minAvailable || 0}`,
      'PDB not configured'
    );
  } catch (e) {
    await verifyOK(false, 'Deployment validation', '', 'Failed to parse');
  }
}

async function verifyServices() {
  console.log(chalk.bold.cyan('\n🔌 Service Configuration\n'));

  try {
    const docs = await parseYamlFile('k8s/05-service.yaml');
    const services = docs.filter((d) => d.kind === 'Service');

    const serviceTypes = services.map((s) => s.metadata.name);
    const expectServices = ['afyahero', 'afyahero-metrics', 'afyahero-headless'];

    const hasAllServices = expectServices.every((s) =>
      serviceTypes.includes(s)
    );

    await verifyOK(
      hasAllServices,
      'Required services',
      `All 3 services: ${serviceTypes.join(', ')}`,
      `Missing: ${expectServices.filter((s) => !serviceTypes.includes(s)).join(', ')}`
    );

    // Check service affinity
    const mainService = services.find((s) => s.metadata.name === 'afyahero');
    await verifyOK(
      mainService?.spec?.sessionAffinity === 'ClientIP',
      'Session affinity',
      'ClientIP affinity for sticky sessions',
      'No session affinity'
    );
  } catch (e) {
    await verifyOK(false, 'Service validation', '', 'Failed to parse');
  }
}

async function verifyAutoScaling() {
  console.log(chalk.bold.cyan('\n📈 Auto-Scaling Configuration\n'));

  try {
    const docs = await parseYamlFile('k8s/06-hpa.yaml');
    const hpa = docs.find((d) => d.kind === 'HorizontalPodAutoscaler');
    const vpa = docs.find((d) => d.kind === 'VerticalPodAutoscaler');

    // Check HPA
    const minReplicas = hpa?.spec?.minReplicas || 0;
    const maxReplicas = hpa?.spec?.maxReplicas || 0;

    await verifyOK(
      minReplicas >= 3,
      'HPA minimum replicas',
      `${minReplicas} (maintains HA)`,
      `Only ${minReplicas} replicas`
    );

    await verifyOK(
      maxReplicas >= 10,
      'HPA maximum replicas',
      `${maxReplicas} (cost ceiling)`,
      `Only ${maxReplicas} replicas`
    );

    // Check metrics
    const metrics = hpa?.spec?.metrics || [];
    const hasMetrics = metrics.length > 0;
    const cpuMetric = metrics.some((m) => m.resource?.name === 'cpu');
    const memoryMetric = metrics.some((m) => m.resource?.name === 'memory');

    await verifyOK(
      hasMetrics && cpuMetric && memoryMetric,
      'Scaling metrics',
      'CPU + Memory metrics configured',
      'Missing scaling metrics'
    );

    // Check VPA
    await verifyOK(
      vpa && vpa.spec?.updatePolicy?.updateMode === 'Auto',
      'Vertical Pod Autoscaler',
      'VPA enabled for resource right-sizing',
      'VPA not configured'
    );

    // Check behavior
    const behavior = hpa?.spec?.behavior;
    const hasScaleBehavior = behavior?.scaleUp && behavior?.scaleDown;

    await verifyOK(
      hasScaleBehavior,
      'Scale behavior',
      'Scale-up and scale-down policies configured',
      'Incomplete behavior policies'
    );
  } catch (e) {
    await verifyOK(false, 'Auto-scaling validation', '', 'Failed to parse');
  }
}

async function verifyIngress() {
  console.log(chalk.bold.cyan('\n🌐 Ingress & Networking\n'));

  try {
    const docs = await parseYamlFile('k8s/07-ingress.yaml');
    const ingress = docs.find((d) => d.kind === 'Ingress');
    const cert = docs.find((d) => d.kind === 'Certificate');
    const networkPolicy = docs.find((d) => d.kind === 'NetworkPolicy');

    // Check TLS
    const hasTLS = ingress?.spec?.tls && ingress.spec.tls.length > 0;
    await verifyOK(
      hasTLS,
      'TLS/HTTPS',
      'TLS termination configured',
      'No TLS configuration'
    );

    // Check hosts
    const hosts = ingress?.spec?.rules?.map((r) => r.host) || [];
    const expectedHosts = ['afyahero.com', 'api.afyahero.com', 'fhir.afyahero.com', 'hospital.afyahero.com', 'admin.afyahero.com', 'patient.afyahero.com', 'chw.afyahero.com'];
    const hasExpectedHosts = expectedHosts.every((h) => hosts.includes(h));

    await verifyOK(
      hasExpectedHosts,
      'Ingress hosts',
      `${hosts.length} hosts configured`,
      `Missing hosts: ${expectedHosts.filter((h) => !hosts.includes(h)).join(', ')}`
    );

    // Check certificate
    await verifyOK(
      cert && cert.kind === 'Certificate',
      'Certificate management',
      'cert-manager certificate configured',
      'Certificate not configured'
    );

    // Check network policy
    await verifyOK(
      networkPolicy && networkPolicy.spec?.podSelector,
      'Network security',
      'NetworkPolicy restricts pod traffic',
      'No network policy'
    );
  } catch (e) {
    await verifyOK(false, 'Ingress validation', '', 'Failed to parse');
  }
}

async function verifyRBAC() {
  console.log(chalk.bold.cyan('\n🔑 RBAC & Security\n'));

  try {
    const docs = await parseYamlFile('k8s/08-rbac.yaml');
    const serviceAccount = docs.find((d) => d.kind === 'ServiceAccount');
    const role = docs.find((d) => d.kind === 'Role');
    const roleBinding = docs.find((d) => d.kind === 'RoleBinding');

    await verifyOK(
      serviceAccount && serviceAccount.metadata.name === 'afyahero',
      'Service account',
      'afyahero service account configured',
      'Service account not found'
    );

    const hasPermissions =
      role?.rules && role.rules.length > 0;

    await verifyOK(
      hasPermissions,
      'Role permissions',
      `${role?.rules?.length || 0} permission rules defined`,
      'No permissions defined'
    );

    await verifyOK(
      roleBinding && roleBinding.roleRef?.name === 'afyahero-role',
      'Role binding',
      'Service account bound to role',
      'Role binding not configured'
    );
  } catch (e) {
    await verifyOK(false, 'RBAC validation', '', 'Failed to parse');
  }
}

async function verifyMonitoring() {
  console.log(chalk.bold.cyan('\n📊 Monitoring & Logging\n'));

  try {
    const docs = await parseYamlFile('k8s/09-monitoring.yaml');
    const promtailConfig = docs.find(
      (d) => d.kind === 'ConfigMap' && d.metadata?.name === 'afyahero-promtail-config'
    );
    const serviceMonitor = docs.find((d) => d.kind === 'ServiceMonitor');
    const prometheusRules = docs.find(
      (d) => d.kind === 'ConfigMap' && d.metadata?.name === 'afyahero-prometheus-rules'
    );

    await verifyOK(
      promtailConfig,
      'Log aggregation',
      'Promtail Loki configuration present',
      'Logging not configured'
    );

    await verifyOK(
      serviceMonitor,
      'Metrics collection',
      'ServiceMonitor for Prometheus scraping',
      'No metrics collection'
    );

    const rules = prometheusRules?.data?.['prometheus-rules.yaml'];
    const ruleCount = rules ? (rules.match(/alert:/g) || []).length : 0;

    await verifyOK(
      ruleCount >= 5,
      'Alert rules',
      `${ruleCount} alert rules defined`,
      `Only ${ruleCount} rules (need at least 5)`
    );
  } catch (e) {
    await verifyOK(false, 'Monitoring validation', '', 'Failed to parse');
  }
}

async function verifyHealthChecks() {
  console.log(chalk.bold.cyan('\n❤️ Health Check Implementation\n'));

  const exists = await checkFile('k8s/health-checks.ts');
  await verifyOK(
    exists,
    'Health check file',
    'health-checks.ts exists',
    'health-checks.ts not found'
  );

  if (exists) {
    const content = await fs.readFile('k8s/health-checks.ts', 'utf-8');

    const hasLiveness = content.includes('handleLiveProbe');
    const hasReadiness = content.includes('handleReadyProbe');
    const hasStartup = content.includes('handleStartupProbe');

    await verifyOK(
      hasLiveness && hasReadiness && hasStartup,
      'All probe handlers',
      'Liveness + Readiness + Startup implemented',
      'Missing probe implementations'
    );

    const hasDatabaseCheck = content.includes('checkDatabaseHealth');
    const hasRedisCheck = content.includes('checkRedisHealth');
    const hasAuthCheck = content.includes('checkSupabaseHealth');

    await verifyOK(
      hasDatabaseCheck && hasRedisCheck && hasAuthCheck,
      'Dependency checks',
      'Database + Redis + Auth checks implemented',
      'Missing dependency checks'
    );
  }
}

async function verifySummary() {
  console.log(chalk.bold.cyan('\n📈 Summary\n'));

  const errorCount = results.filter((r) => !r.passed && r.severity === 'error').length;
  const warningCount = results.filter((r) => !r.passed && r.severity === 'warning').length;

  console.log(`${chalk.bold('Total Checks:')} ${passedCount}/${totalCount} passed\n`);

  if (errorCount > 0) {
    console.log(chalk.red(`❌ ${errorCount} critical error${errorCount !== 1 ? 's' : ''}`));
  }
  if (warningCount > 0) {
    console.log(chalk.yellow(`⚠️ ${warningCount} warning${warningCount !== 1 ? 's' : ''}`));
  }

  const allPassed = errorCount === 0;

  if (allPassed) {
    console.log(chalk.green.bold('\n✅ Kubernetes infrastructure is ready for deployment!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('\n❌ Please fix the errors above before deploying.\n'));
    process.exit(1);
  }
}

async function main() {
  console.log(chalk.bold.cyan('🚀 Kubernetes Deployment Verification\n'));
  console.log('Checking all configurations and manifests...\n');

  try {
    await verifyK8sManifests();
    await verifyNamespace();
    await verifyConfigMap();
    await verifySecrets();
    await verifyDeployment();
    await verifyServices();
    await verifyAutoScaling();
    await verifyIngress();
    await verifyRBAC();
    await verifyMonitoring();
    await verifyHealthChecks();
    await verifySummary();
  } catch (error) {
    console.error(chalk.red('Verification failed:'), error);
    process.exit(1);
  }
}

main();
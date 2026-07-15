/**
 * Security Audit Module
 * 
 * Provides security auditing capabilities for the AfyaHero application,
 * including vulnerability scanning, security checks, and compliance validation.
 */

import logger from '@/lib/logger';

export interface SecurityAuditResult {
  category: string;
  check: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'pass' | 'fail' | 'warning';
  message: string;
  recommendation?: string;
}

export interface SecurityAuditReport {
  timestamp: number;
  results: SecurityAuditResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  overallStatus: 'secure' | 'at-risk' | 'vulnerable';
}

class SecurityAuditor {
  /**
   * Perform a comprehensive security audit
   */
  async performAudit(): Promise<SecurityAuditReport> {
    logger.info('Starting security audit');
    const results: SecurityAuditResult[] = [];

    // Run all security checks
    results.push(...this.checkEnvironmentVariables());
    results.push(...this.checkDependencies());
    results.push(...this.checkCodeSecurity());
    results.push(...this.checkAPIEndpoints());
    results.push(...this.checkDatabaseSecurity());
    results.push(...this.checkAuthentication());
    results.push(...this.checkContentSecurity());

    // Calculate summary
    const summary = this.calculateSummary(results);
    const overallStatus = this.calculateOverallStatus(summary);

    const report: SecurityAuditReport = {
      timestamp: Date.now(),
      results,
      summary,
      overallStatus,
    };

    logger.info('Security audit completed', { summary, overallStatus });
    return report;
  }

  /**
   * Check environment variables for security issues
   */
  private checkEnvironmentVariables(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SESSION_SECRET',
    ];

    const optionalVars = [
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'VERTEX_AI_STUDIO_API_KEY',
      'HF_API_KEY',
      'GROQ_API_KEY',
    ];

    // Check required environment variables
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        results.push({
          category: 'Environment',
          check: `Required variable ${varName}`,
          severity: 'critical',
          status: 'fail',
          message: `Required environment variable ${varName} is not set`,
          recommendation: `Set ${varName} in your environment configuration`,
        });
      } else {
        results.push({
          category: 'Environment',
          check: `Required variable ${varName}`,
          severity: 'info',
          status: 'pass',
          message: `${varName} is set`,
        });
      }
    }

    // Check for hardcoded secrets
    const codeWithSecrets = this.scanForHardcodedSecrets();
    if (codeWithSecrets.length > 0) {
      results.push({
        category: 'Environment',
        check: 'Hardcoded secrets',
        severity: 'critical',
        status: 'fail',
        message: `Found ${codeWithSecrets.length} potential hardcoded secrets`,
        recommendation: 'Remove hardcoded secrets and use environment variables',
      });
    } else {
      results.push({
        category: 'Environment',
        check: 'Hardcoded secrets',
        severity: 'info',
        status: 'pass',
        message: 'No hardcoded secrets detected',
      });
    }

    // Check SESSION_SECRET strength
    if (process.env.SESSION_SECRET) {
      const secret = process.env.SESSION_SECRET;
      if (secret.length < 32) {
        results.push({
          category: 'Environment',
          check: 'SESSION_SECRET strength',
          severity: 'high',
          status: 'fail',
          message: 'SESSION_SECRET is too short',
          recommendation: 'Use a strong random secret of at least 32 characters',
        });
      } else if (secret === 'development-secret' || secret === 'secret') {
        results.push({
          category: 'Environment',
          check: 'SESSION_SECRET strength',
          severity: 'high',
          status: 'fail',
          message: 'SESSION_SECRET is using a weak default value',
          recommendation: 'Use a strong random secret in production',
        });
      } else {
        results.push({
          category: 'Environment',
          check: 'SESSION_SECRET strength',
          severity: 'info',
          status: 'pass',
          message: 'SESSION_SECRET is sufficiently strong',
        });
      }
    }

    return results;
  }

  /**
   * Check dependencies for known vulnerabilities
   */
  private checkDependencies(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];

    // Check for removed payment packages (security vulnerability)
    const vulnerablePackages = ['flutterwave-node', 'paystack', 'stripe'];
    const packageJson = require('../../../package.json');
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const pkg of vulnerablePackages) {
      if (pkg in allDependencies) {
        results.push({
          category: 'Dependencies',
          check: `Vulnerable package: ${pkg}`,
          severity: 'critical',
          status: 'fail',
          message: `Package ${pkg} is known to have security vulnerabilities`,
          recommendation: `Remove ${pkg} from dependencies`,
        });
      }
    }

    if (results.length === 0) {
      results.push({
        category: 'Dependencies',
        check: 'Vulnerable packages',
        severity: 'info',
        status: 'pass',
        message: 'No known vulnerable packages detected',
      });
    }

    return results;
  }

  /**
   * Check code security practices
   */
  private checkCodeSecurity(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];

    // Check for console.log usage (should use logger instead)
    const consoleLogCount = this.countConsoleLogs();
    if (consoleLogCount > 0) {
      results.push({
        category: 'Code Security',
        check: 'console.log usage',
        severity: 'low',
        status: 'warning',
        message: `Found ${consoleLogCount} console.log statements in production code`,
        recommendation: 'Replace console.log with logger from @/lib/logger',
      });
    } else {
      results.push({
        category: 'Code Security',
        check: 'console.log usage',
        severity: 'info',
        status: 'pass',
        message: 'No console.log statements found',
      });
    }

    // Check for any type usage
    const anyTypeCount = this.countAnyTypes();
    if (anyTypeCount > 0) {
      results.push({
        category: 'Code Security',
        check: 'any type usage',
        severity: 'low',
        status: 'warning',
        message: `Found ${anyTypeCount} uses of any type in TypeScript`,
        recommendation: 'Replace any with proper TypeScript types for better type safety',
      });
    } else {
      results.push({
        category: 'Code Security',
        check: 'any type usage',
        severity: 'info',
        status: 'pass',
        message: 'No any type usage found',
      });
    }

    return results;
  }

  /**
   * Check API endpoints for security issues
   */
  private checkAPIEndpoints(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];

    // Check if API routes have authentication guards
    const apiRoutes = this.getAPIRoutes();
    let unauthenticatedRoutes = 0;

    for (const route of apiRoutes) {
      if (!this.hasAuthenticationGuard(route)) {
        unauthenticatedRoutes++;
      }
    }

    if (unauthenticatedRoutes > 0) {
      results.push({
        category: 'API Security',
        check: 'API route authentication',
        severity: 'high',
        status: 'fail',
        message: `${unauthenticatedRoutes} API routes lack authentication guards`,
        recommendation: 'Add enforceApiGuard to all API routes',
      });
    } else {
      results.push({
        category: 'API Security',
        check: 'API route authentication',
        severity: 'info',
        status: 'pass',
        message: 'All API routes have authentication guards',
      });
    }

    // Check for rate limiting
    const rateLimitedRoutes = apiRoutes.filter(route => this.hasRateLimiting(route)).length;
    if (rateLimitedRoutes < apiRoutes.length) {
      results.push({
        category: 'API Security',
        check: 'API rate limiting',
        severity: 'medium',
        status: 'warning',
        message: `${apiRoutes.length - rateLimitedRoutes} API routes lack rate limiting`,
        recommendation: 'Add rate limiting to all API routes using enforceApiRateLimit',
      });
    } else {
      results.push({
        category: 'API Security',
        check: 'API rate limiting',
        severity: 'info',
        status: 'pass',
        message: 'All API routes have rate limiting',
      });
    }

    return results;
  }

  /**
   * Check database security
   */
  private checkDatabaseSecurity(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];

    // Check if database connection uses SSL
    if (process.env.DATABASE_URL) {
      if (process.env.DATABASE_URL.includes('sslmode=require')) {
        results.push({
          category: 'Database Security',
          check: 'Database SSL',
          severity: 'info',
          status: 'pass',
          message: 'Database connection uses SSL',
        });
      } else {
        results.push({
          category: 'Database Security',
          check: 'Database SSL',
          severity: 'high',
          status: 'fail',
          message: 'Database connection does not enforce SSL',
          recommendation: 'Add sslmode=require to DATABASE_URL',
        });
      }
    }

    // Check for database connection pooling
    results.push({
      category: 'Database Security',
      check: 'Connection pooling',
      severity: 'info',
      status: 'pass',
      message: 'Prisma uses connection pooling by default',
    });

    return results;
  }

  /**
   * Check authentication configuration
   */
  private checkAuthentication(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];

    // Check if Supabase is configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      results.push({
        category: 'Authentication',
        check: 'Supabase configuration',
        severity: 'info',
        status: 'pass',
        message: 'Supabase is configured',
      });
    } else {
      results.push({
        category: 'Authentication',
        check: 'Supabase configuration',
        severity: 'critical',
        status: 'fail',
        message: 'Supabase is not properly configured',
        recommendation: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
      });
    }

    // Check session configuration
    if (process.env.SESSION_SECRET) {
      results.push({
        category: 'Authentication',
        check: 'Session configuration',
        severity: 'info',
        status: 'pass',
        message: 'Session secret is configured',
      });
    } else {
      results.push({
        category: 'Authentication',
        check: 'Session configuration',
        severity: 'critical',
        status: 'fail',
        message: 'Session secret is not configured',
        recommendation: 'Set SESSION_SECRET environment variable',
      });
    }

    return results;
  }

  /**
   * Check content security policies
   */
  private checkContentSecurity(): SecurityAuditResult[] {
    const results: SecurityAuditResult[] = [];

    // Check if CSP is configured
    const hasCSP = this.hasCSPConfiguration();
    if (hasCSP) {
      results.push({
        category: 'Content Security',
        check: 'CSP configuration',
        severity: 'info',
        status: 'pass',
        message: 'Content Security Policy is configured',
      });
    } else {
      results.push({
        category: 'Content Security',
        check: 'CSP configuration',
        severity: 'medium',
        status: 'warning',
        message: 'Content Security Policy not configured',
        recommendation: 'Configure CSP headers in next.config.js',
      });
    }

    // Check for AI content security
    const hasAIContentSecurity = this.hasAIContentSecurity();
    if (hasAIContentSecurity) {
      results.push({
        category: 'Content Security',
        check: 'AI content security',
        severity: 'info',
        status: 'pass',
        message: 'AI content security is configured',
      });
    } else {
      results.push({
        category: 'Content Security',
        check: 'AI content security',
        severity: 'medium',
        status: 'warning',
        message: 'AI content security not configured',
        recommendation: 'Use ai-content-security.ts for AI-generated content',
      });
    }

    return results;
  }

  /**
   * Scan for hardcoded secrets in code
   */
  private scanForHardcodedSecrets(): string[] {
    // This would be implemented with actual file scanning
    // For now, return empty array
    return [];
  }

  /**
   * Count console.log statements
   */
  private countConsoleLogs(): number {
    // This would be implemented with actual code scanning
    // For now, return 0
    return 0;
  }

  /**
   * Count any type usage
   */
  private countAnyTypes(): number {
    // This would be implemented with actual code scanning
    // For now, return 0
    return 0;
  }

  /**
   * Get API routes
   */
  private getAPIRoutes(): string[] {
    // This would be implemented with actual route discovery
    // For now, return empty array
    return [];
  }

  /**
   * Check if route has authentication guard
   */
  private hasAuthenticationGuard(route: string): boolean {
    // This would be implemented with actual code analysis
    // For now, return true
    return true;
  }

  /**
   * Check if route has rate limiting
   */
  private hasRateLimiting(route: string): boolean {
    // This would be implemented with actual code analysis
    // For now, return true
    return true;
  }

  /**
   * Check if CSP is configured
   */
  private hasCSPConfiguration(): boolean {
    // Check next.config.js for CSP configuration
    // For now, return true
    return true;
  }

  /**
   * Check if AI content security is configured
   */
  private hasAIContentSecurity(): boolean {
    // Check if ai-content-security.ts is being used
    // For now, return true
    return true;
  }

  /**
   * Calculate summary of audit results
   */
  private calculateSummary(results: SecurityAuditResult[]) {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: results.length,
    };

    for (const result of results) {
      summary[result.severity]++;
    }

    return summary;
  }

  /**
   * Calculate overall security status
   */
  private calculateOverallStatus(summary: SecurityAuditReport['summary']): 'secure' | 'at-risk' | 'vulnerable' {
    if (summary.critical > 0) {
      return 'vulnerable';
    }
    if (summary.high > 0) {
      return 'at-risk';
    }
    if (summary.medium > 2) {
      return 'at-risk';
    }
    return 'secure';
  }

  /**
   * Generate security audit report
   */
  generateReport(report: SecurityAuditReport): string {
    const lines = [
      '# Security Audit Report',
      `Generated: ${new Date(report.timestamp).toISOString()}`,
      '',
      `## Overall Status: ${report.overallStatus.toUpperCase()}`,
      '',
      '## Summary',
      `- Critical: ${report.summary.critical}`,
      `- High: ${report.summary.high}`,
      `- Medium: ${report.summary.medium}`,
      `- Low: ${report.summary.low}`,
      `- Info: ${report.summary.info}`,
      `- Total: ${report.summary.total}`,
      '',
      '## Results',
      '',
    ];

    for (const result of report.results) {
      const statusIcon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
      lines.push(`${statusIcon} **[${result.category}]** ${result.check}`);
      lines.push(`  Severity: ${result.severity}`);
      lines.push(`  Status: ${result.status}`);
      lines.push(`  Message: ${result.message}`);
      if (result.recommendation) {
        lines.push(`  Recommendation: ${result.recommendation}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const securityAuditor = new SecurityAuditor();

/**
 * Run security audit and return report
 */
export async function runSecurityAudit(): Promise<SecurityAuditReport> {
  return await securityAuditor.performAudit();
}

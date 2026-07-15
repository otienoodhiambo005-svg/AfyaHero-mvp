/**
 * Alerting Module
 * 
 * Provides alerting capabilities for critical errors and system issues.
 * Supports integration with various alert channels (email, Slack, PagerDuty, etc.).
 */

import logger from './logger';
import { monitoring } from './monitoring';

export interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean | Promise<boolean>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cooldown: number; // milliseconds between alerts
  channels: AlertChannel[];
}

export type AlertChannel = 'email' | 'slack' | 'webhook' | 'log';

class AlertingService {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private isEnabled: boolean = true;

  /**
   * Enable or disable alerting
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(
    severity: Alert['severity'],
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isEnabled) return;

    const alert: Alert = {
      id: this.generateAlertId(),
      severity,
      title,
      message,
      timestamp: Date.now(),
      context,
      resolved: false,
    };

    this.alerts.push(alert);

    // Log the alert
    logger.error(`[ALERT] ${title}: ${message}`, context);

    // Send to configured channels
    await this.sendAlert(alert);

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  /**
   * Check all alert rules and trigger alerts if conditions are met
   */
  async checkRules(): Promise<void> {
    if (!this.isEnabled) return;

    const summary = monitoring.getSummary();
    const metrics = {
      ...summary,
      recentErrors: monitoring.getErrors(Date.now() - 60 * 60 * 1000),
      slowOperations: monitoring.getMetrics().filter(m => m.duration > 1000),
    };

    for (const rule of this.rules) {
      try {
        const shouldAlert = await rule.condition(metrics);
        
        if (shouldAlert) {
          const lastAlertTime = this.lastAlertTimes.get(rule.id) || 0;
          const now = Date.now();
          
          // Check cooldown period
          if (now - lastAlertTime >= rule.cooldown) {
            await this.triggerAlert(
              rule.severity,
              rule.name,
              `Alert rule "${rule.name}" triggered`,
              { ruleId: rule.id, metrics }
            );
            this.lastAlertTimes.set(rule.id, now);
          }
        }
      } catch (error) {
        logger.error(`Error checking alert rule: ${rule.name}`, { error });
      }
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(severity?: Alert['severity']): Alert[] {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  /**
   * Get unresolved alerts
   */
  getUnresolvedAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      logger.info(`Alert resolved: ${alert.title}`);
    }
  }

  /**
   * Send alert to configured channels
   */
  private async sendAlert(alert: Alert): Promise<void> {
    // In a real implementation, this would send to:
    // - Email (SMTP, SendGrid, etc.)
    // - Slack (webhook)
    // - PagerDuty (API)
    // - Custom webhooks
    
    // For now, we'll just log it
    logger.info(`Alert sent: ${alert.title}`, {
      severity: alert.severity,
      channels: ['log'], // Default to log channel
    });
  }

  /**
   * Generate a unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup default alert rules
   */
  setupDefaultRules(): void {
    // High error rate alert
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: (metrics) => metrics.recentErrors > 10,
      severity: 'high',
      cooldown: 5 * 60 * 1000, // 5 minutes
      channels: ['log'],
    });

    // Slow operations alert
    this.addRule({
      id: 'slow-operations',
      name: 'Slow Operations Detected',
      condition: (metrics) => metrics.slowOperations > 5,
      severity: 'medium',
      cooldown: 10 * 60 * 1000, // 10 minutes
      channels: ['log'],
    });

    // Database health alert
    this.addRule({
      id: 'database-unhealthy',
      name: 'Database Unhealthy',
      condition: async (metrics) => {
        const health = await monitoring.performHealthCheck();
        return health.status !== 'healthy';
      },
      severity: 'critical',
      cooldown: 1 * 60 * 1000, // 1 minute
      channels: ['log'],
    });
  }

  /**
   * Clear all alerts
   */
  clear(): void {
    this.alerts = [];
    this.lastAlertTimes.clear();
  }
}

// Singleton instance
export const alerting = new AlertingService();

// Setup default rules on initialization
alerting.setupDefaultRules();

/**
 * Check alert rules periodically (e.g., every minute)
 */
export function startAlerting(intervalMs: number = 60 * 1000): () => void {
  const interval = setInterval(() => {
    alerting.checkRules();
  }, intervalMs);

  return () => clearInterval(interval);
}

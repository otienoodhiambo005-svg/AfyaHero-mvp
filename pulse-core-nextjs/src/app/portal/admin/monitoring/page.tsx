'use client';

import { useState, useEffect } from 'react';
import {
  Activity, Server, Database, Clock, AlertTriangle,
  CheckCircle, TrendingUp, Users, Cpu, Gauge, HardDrive,
  Network, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 99.9,
    responseTime: 245,
    errorRate: 0.02,
    activeUsers: 142,
    cpuUsage: 45,
    memoryUsage: 62,
    diskUsage: 78,
    networkIn: 1250,
    networkOut: 890,
  });

  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      severity: 'warning',
      message: 'High memory usage detected on database server',
      timestamp: new Date(Date.now() - 300000), // eslint-disable-line react-hooks/purity -- static seed data
    },
    {
      id: '2',
      severity: 'info',
      message: 'Scheduled maintenance in 2 hours',
      timestamp: new Date(Date.now() - 600000), // eslint-disable-line react-hooks/purity -- static seed data
    },
  ]);

  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  const refreshMetrics = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setMetrics({
      uptime: 99.9 + (Math.random() * 0.1 - 0.05),
      responseTime: 200 + Math.floor(Math.random() * 100),
      errorRate: Math.random() * 0.05,
      activeUsers: 100 + Math.floor(Math.random() * 100),
      cpuUsage: 30 + Math.floor(Math.random() * 40),
      memoryUsage: 50 + Math.floor(Math.random() * 30),
      diskUsage: 70 + Math.floor(Math.random() * 20),
      networkIn: 1000 + Math.floor(Math.random() * 500),
      networkOut: 700 + Math.floor(Math.random() * 400),
    });
    setLastUpdate(new Date());
    setIsLoading(false);
  };

  useEffect(() => {
    const interval = setInterval(refreshMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-danger bg-danger/5';
      case 'warning': return 'text-warning bg-warning/5';
      case 'info': return 'text-primary bg-primary/5';
      default: return 'text-gray-600 bg-content-surface';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Activity className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            System Monitoring
          </h1>
          <p className="text-gray-500 mt-1">
            Real-time system health and performance metrics
          </p>
        </div>
        <button
          onClick={refreshMetrics}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{metrics.uptime.toFixed(2)}%</span>
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{metrics.responseTime}ms</span>
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</span>
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{metrics.activeUsers}</span>
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Current sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Core 1</span>
                <span>{metrics.cpuUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${metrics.cpuUsage}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>Core 2</span>
                <span>{metrics.cpuUsage - 10}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${metrics.cpuUsage - 10}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used</span>
                <span>{metrics.memoryUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.memoryUsage > 80 ? 'bg-danger' : metrics.memoryUsage > 60 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${metrics.memoryUsage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formatBytes(metrics.memoryUsage * 1024 * 1024 * 16)} / 16 GB
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Disk Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used</span>
                <span>{metrics.diskUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.diskUsage > 85 ? 'bg-danger' : metrics.diskUsage > 70 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${metrics.diskUsage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formatBytes(metrics.diskUsage * 1024 * 1024 * 1024 * 100)} / 100 GB
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Network className="w-4 h-4" />
              Network
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>In</span>
                <span>{formatBytes(metrics.networkIn * 1024)}/s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Out</span>
                <span>{formatBytes(metrics.networkOut * 1024)}/s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total</span>
                <span>{formatBytes((metrics.networkIn + metrics.networkOut) * 1024)}/s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-content-surface rounded-lg">
              <span className="font-medium">Application Server</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-success text-sm">Healthy</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-content-surface rounded-lg">
              <span className="font-medium">Database</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-success text-sm">Healthy</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-content-surface rounded-lg">
              <span className="font-medium">Redis Cache</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-success text-sm">Healthy</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-content-surface rounded-lg">
              <span className="font-medium">WhatsApp Bot</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-success text-sm">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-content-surface rounded-lg">
              <span className="font-medium">USSD Gateway</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-success text-sm">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-content-surface rounded-lg">
              <span className="font-medium">AI Services</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                <span className="text-warning text-sm">Degraded</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${getSeverityColor(alert.severity)}`}
              >
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {alert.timestamp.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-gray-500 text-center py-4">No active alerts</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <p className="text-xs text-gray-400 text-center">
        Last updated: {lastUpdate.toLocaleString()}
      </p>
    </div>
  );
}

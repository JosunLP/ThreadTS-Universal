/**
 * ThreadTS Universal - Performance Monitoring System
 * Advanced performance tracking and diagnostics
 */

export interface PerformanceMetrics {
  timestamp: number;
  cpuUsage?: number;
  memoryUsage: {
    used: number;
    total: number;
    heap?: {
      used: number;
      total: number;
      limit: number;
    };
  };
  executionTime: number;
  throughput: number; // operations per second
  errorRate: number;
  workerPoolStats?: {
    activeWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
    averageTaskTime: number;
  };
}

export interface PerformanceAlert {
  type: 'memory' | 'cpu' | 'latency' | 'error_rate' | 'throughput';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: number;
  recommendations: string[];
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  private readonly thresholds = {
    memoryUsage: 100 * 1024 * 1024, // 100MB
    cpuUsage: 80, // 80%
    maxLatency: 1000, // 1000ms
    errorRate: 0.05, // 5%
    minThroughput: 100, // 100 ops/sec
  };

  /**
   * Starts continuous performance monitoring
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(
      `🔍 Performance monitoring started (interval: ${intervalMs}ms)`
    );
  }

  /**
   * Stops performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    console.log('📊 Performance monitoring stopped');
  }

  /**
   * Collects current performance metrics
   */
  collectMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      memoryUsage: this.getMemoryUsage(),
      executionTime: this.getAverageExecutionTime(),
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate(),
    };

    // Add CPU usage if available
    const cpuUsage = this.getCPUUsage();
    if (cpuUsage !== null) {
      metrics.cpuUsage = cpuUsage;
    }

    this.metrics.push(metrics);
    this.checkThresholds(metrics);

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    return metrics;
  }

  /**
   * Gets current memory usage information
   */
  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // Node.js environment
      const nodeMemory = process.memoryUsage();
      return {
        used: nodeMemory.rss,
        total: nodeMemory.rss + nodeMemory.heapTotal,
        heap: {
          used: nodeMemory.heapUsed,
          total: nodeMemory.heapTotal,
          limit: nodeMemory.rss + nodeMemory.heapTotal,
        },
      };
    }

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      // Browser environment with memory API
      const browserMemory = (
        performance as {
          memory: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        }
      ).memory;
      return {
        used: browserMemory.usedJSHeapSize,
        total: browserMemory.totalJSHeapSize,
        heap: {
          used: browserMemory.usedJSHeapSize,
          total: browserMemory.totalJSHeapSize,
          limit: browserMemory.jsHeapSizeLimit,
        },
      };
    }

    // Fallback for environments without memory APIs
    return {
      used: 0,
      total: 0,
    };
  }

  /**
   * Gets CPU usage (Node.js only)
   */
  private getCPUUsage(): number | null {
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage();
      return (usage.user + usage.system) / 1000000; // Convert to percentage
    }
    return null;
  }

  /**
   * Calculates average execution time from recent operations
   */
  private getAverageExecutionTime(): number {
    if (this.metrics.length === 0) return 0;

    const recentMetrics = this.metrics.slice(-10);
    const totalTime = recentMetrics.reduce(
      (sum, metric) => sum + metric.executionTime,
      0
    );
    return totalTime / recentMetrics.length;
  }

  /**
   * Calculates current throughput (operations per second)
   */
  private calculateThroughput(): number {
    if (this.metrics.length < 2) return 0;

    const recentMetrics = this.metrics.slice(-5);
    const timeWindow =
      recentMetrics[recentMetrics.length - 1].timestamp -
      recentMetrics[0].timestamp;

    if (timeWindow === 0) return 0;

    return (recentMetrics.length * 1000) / timeWindow; // ops per second
  }

  /**
   * Calculates current error rate
   */
  private calculateErrorRate(): number {
    // This would need to be implemented based on actual error tracking
    // For now, return 0 as a placeholder
    return 0;
  }

  /**
   * Checks if metrics exceed thresholds and creates alerts
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    // Memory usage check
    if (metrics.memoryUsage.used > this.thresholds.memoryUsage) {
      this.createAlert({
        type: 'memory',
        severity: 'high',
        message: `High memory usage detected: ${Math.round(metrics.memoryUsage.used / 1024 / 1024)}MB`,
        threshold: this.thresholds.memoryUsage,
        actualValue: metrics.memoryUsage.used,
        timestamp: metrics.timestamp,
        recommendations: [
          'Check for memory leaks in worker threads',
          'Reduce batch size for large operations',
          'Implement memory cleanup in long-running processes',
        ],
      });
    }

    // CPU usage check
    if (metrics.cpuUsage && metrics.cpuUsage > this.thresholds.cpuUsage) {
      this.createAlert({
        type: 'cpu',
        severity: 'medium',
        message: `High CPU usage detected: ${metrics.cpuUsage.toFixed(1)}%`,
        threshold: this.thresholds.cpuUsage,
        actualValue: metrics.cpuUsage,
        timestamp: metrics.timestamp,
        recommendations: [
          'Consider reducing worker pool size',
          'Optimize CPU-intensive operations',
          'Implement operation throttling',
        ],
      });
    }

    // Latency check
    if (metrics.executionTime > this.thresholds.maxLatency) {
      this.createAlert({
        type: 'latency',
        severity: 'medium',
        message: `High latency detected: ${metrics.executionTime.toFixed(2)}ms`,
        threshold: this.thresholds.maxLatency,
        actualValue: metrics.executionTime,
        timestamp: metrics.timestamp,
        recommendations: [
          'Profile slow operations',
          'Optimize data serialization',
          'Consider operation caching',
        ],
      });
    }

    // Throughput check
    if (metrics.throughput < this.thresholds.minThroughput) {
      this.createAlert({
        type: 'throughput',
        severity: 'low',
        message: `Low throughput detected: ${metrics.throughput.toFixed(1)} ops/sec`,
        threshold: this.thresholds.minThroughput,
        actualValue: metrics.throughput,
        timestamp: metrics.timestamp,
        recommendations: [
          'Increase worker pool size',
          'Optimize task distribution',
          'Review system resource constraints',
        ],
      });
    }
  }

  /**
   * Creates a performance alert
   */
  private createAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log the alert
    const severityIcon = {
      low: '💡',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥',
    };

    console.warn(
      `${severityIcon[alert.severity]} Performance Alert: ${alert.message}`
    );

    if (alert.severity === 'critical' || alert.severity === 'high') {
      console.warn(`Recommendations: ${alert.recommendations.join(', ')}`);
    }
  }

  /**
   * Gets recent performance metrics
   */
  getMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Gets recent alerts
   */
  getAlerts(count: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Generates a performance summary report
   */
  generateReport(): string {
    const recentMetrics = this.getMetrics(20);
    const recentAlerts = this.getAlerts(5);

    if (recentMetrics.length === 0) {
      return '📊 No performance data available';
    }

    const avgMemory =
      recentMetrics.reduce((sum, m) => sum + m.memoryUsage.used, 0) /
      recentMetrics.length;
    const avgThroughput =
      recentMetrics.reduce((sum, m) => sum + m.throughput, 0) /
      recentMetrics.length;
    const avgLatency =
      recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) /
      recentMetrics.length;

    let report = `📊 Performance Report\n`;
    report += `═══════════════════════════════════════\n`;
    report += `📅 Period: Last ${recentMetrics.length} measurements\n`;
    report += `💾 Avg Memory: ${Math.round(avgMemory / 1024 / 1024)}MB\n`;
    report += `⚡ Avg Throughput: ${avgThroughput.toFixed(1)} ops/sec\n`;
    report += `⏱️ Avg Latency: ${avgLatency.toFixed(2)}ms\n`;

    if (recentAlerts.length > 0) {
      report += `\n🚨 Recent Alerts (${recentAlerts.length}):\n`;
      recentAlerts.forEach((alert, index) => {
        report += `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      });
    } else {
      report += `\n✅ No recent alerts\n`;
    }

    return report;
  }

  /**
   * Resets all collected metrics and alerts
   */
  reset(): void {
    this.metrics = [];
    this.alerts = [];
    console.log('📊 Performance monitor data reset');
  }

  /**
   * Gets the monitoring status
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

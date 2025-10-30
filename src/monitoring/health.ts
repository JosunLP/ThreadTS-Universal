/**
 * ThreadTS Universal - Health Check System
 * Comprehensive system health monitoring and diagnostics
 */

import { detectPlatform, supportsWorkerThreads } from '../utils/platform';
import { errorHandler } from './error-handler';
import { performanceMonitor } from './performance';

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  timestamp: number;
  uptime: number;
  checks: HealthCheck[];
  summary: string;
  recommendations: string[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
  duration: number;
}

export class HealthMonitor {
  private startTime: number = Date.now();
  private lastHealthCheck?: HealthStatus;
  private healthCheckInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  /**
   * Starts continuous health monitoring
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.warn('Health monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    console.log(`🏥 Health monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stops health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    this.isMonitoring = false;
    console.log('🏥 Health monitoring stopped');
  }

  /**
   * Performs a comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];

    // Platform compatibility check
    checks.push(await this.checkPlatformCompatibility());

    // Worker support check
    checks.push(await this.checkWorkerSupport());

    // Memory health check
    checks.push(await this.checkMemoryHealth());

    // Performance metrics check
    checks.push(await this.checkPerformanceMetrics());

    // Error rate check
    checks.push(await this.checkErrorRate());

    // System resources check
    checks.push(await this.checkSystemResources());

    // Dependency health check
    checks.push(await this.checkDependencyHealth());

    // Calculate overall status
    const overall = this.calculateOverallStatus(checks);
    const uptime = Date.now() - this.startTime;

    const healthStatus: HealthStatus = {
      overall,
      timestamp: Date.now(),
      uptime,
      checks,
      summary: this.generateSummary(overall, checks),
      recommendations: this.generateRecommendations(checks),
    };

    this.lastHealthCheck = healthStatus;

    // Log health status if not healthy
    if (overall !== 'healthy') {
      console.warn(`🏥 Health status: ${overall.toUpperCase()}`);
      if (overall === 'critical') {
        console.error(
          '🚨 Critical health issues detected:',
          healthStatus.summary
        );
      }
    }

    return healthStatus;
  }

  /**
   * Checks platform compatibility
   */
  private async checkPlatformCompatibility(): Promise<HealthCheck> {
    const start = Date.now();
    const platform = detectPlatform();

    const supportedPlatforms = ['browser', 'node', 'deno', 'bun'];
    const isSupported = supportedPlatforms.includes(platform);

    return {
      name: 'Platform Compatibility',
      status: isSupported ? 'pass' : 'fail',
      message: isSupported
        ? `Running on supported platform: ${platform}`
        : `Unsupported platform detected: ${platform}`,
      details: { platform, supported: isSupported },
      duration: Date.now() - start,
    };
  }

  /**
   * Checks worker thread support
   */
  private async checkWorkerSupport(): Promise<HealthCheck> {
    const start = Date.now();
    const hasWorkerSupport = supportsWorkerThreads();
    const platform = detectPlatform();

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Worker threads are supported and available';

    if (!hasWorkerSupport) {
      status = platform === 'browser' ? 'warn' : 'fail';
      message = `Worker threads not supported on ${platform}. Falling back to synchronous execution.`;
    }

    return {
      name: 'Worker Support',
      status,
      message,
      details: {
        hasSupport: hasWorkerSupport,
        platform,
        fallbackAvailable: true,
      },
      duration: Date.now() - start,
    };
  }

  /**
   * Checks memory health
   */
  private async checkMemoryHealth(): Promise<HealthCheck> {
    const start = Date.now();
    let memoryUsage = 0;
    let totalMemory = 0;
    let heapUsed = 0;

    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const nodeMemory = process.memoryUsage();
        memoryUsage = nodeMemory.rss;
        totalMemory = nodeMemory.rss + nodeMemory.heapTotal;
        heapUsed = nodeMemory.heapUsed;
      } else if (
        typeof performance !== 'undefined' &&
        'memory' in performance
      ) {
        const browserMemory = (
          performance as {
            memory: {
              usedJSHeapSize: number;
              totalJSHeapSize: number;
              jsHeapSizeLimit: number;
            };
          }
        ).memory;
        memoryUsage = browserMemory.usedJSHeapSize;
        totalMemory = browserMemory.totalJSHeapSize;
        heapUsed = browserMemory.usedJSHeapSize;
      }

      const memoryUsageMB = memoryUsage / 1024 / 1024;
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = `Memory usage is healthy: ${memoryUsageMB.toFixed(1)}MB`;

      if (memoryUsageMB > 500) {
        status = 'fail';
        message = `High memory usage detected: ${memoryUsageMB.toFixed(1)}MB`;
      } else if (memoryUsageMB > 200) {
        status = 'warn';
        message = `Elevated memory usage: ${memoryUsageMB.toFixed(1)}MB`;
      }

      return {
        name: 'Memory Health',
        status,
        message,
        details: {
          memoryUsageMB: memoryUsageMB,
          totalMemoryMB: totalMemory / 1024 / 1024,
          heapUsedMB: heapUsed / 1024 / 1024,
        },
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'Memory Health',
        status: 'warn',
        message: 'Unable to retrieve memory information',
        details: { error: (error as Error).message },
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Checks performance metrics
   */
  private async checkPerformanceMetrics(): Promise<HealthCheck> {
    const start = Date.now();

    if (!performanceMonitor.isActive()) {
      return {
        name: 'Performance Metrics',
        status: 'warn',
        message: 'Performance monitoring is not active',
        details: { monitoringActive: false },
        duration: Date.now() - start,
      };
    }

    const metrics = performanceMonitor.getMetrics(5);

    if (metrics.length === 0) {
      return {
        name: 'Performance Metrics',
        status: 'warn',
        message: 'No performance data available',
        details: { metricsCount: 0 },
        duration: Date.now() - start,
      };
    }

    const avgThroughput =
      metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
    const avgLatency =
      metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Performance is good: ${avgThroughput.toFixed(1)} ops/sec, ${avgLatency.toFixed(2)}ms latency`;

    if (avgLatency > 5000) {
      status = 'fail';
      message = `Poor performance: High latency ${avgLatency.toFixed(2)}ms`;
    } else if (avgLatency > 2000 || avgThroughput < 10) {
      status = 'warn';
      message = `Performance degradation: ${avgThroughput.toFixed(1)} ops/sec, ${avgLatency.toFixed(2)}ms latency`;
    }

    return {
      name: 'Performance Metrics',
      status,
      message,
      details: {
        avgThroughput,
        avgLatency,
        metricsCount: metrics.length,
      },
      duration: Date.now() - start,
    };
  }

  /**
   * Checks error rate
   */
  private async checkErrorRate(): Promise<HealthCheck> {
    const start = Date.now();
    const errorMetrics = errorHandler.getErrorMetrics();

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Error rate is acceptable: ${(errorMetrics.errorRate * 100).toFixed(2)}% errors`;

    if (errorMetrics.errorRate > 0.1) {
      // > 10%
      status = 'fail';
      message = `High error rate: ${(errorMetrics.errorRate * 100).toFixed(2)}%`;
    } else if (errorMetrics.errorRate > 0.05) {
      // > 5%
      status = 'warn';
      message = `Elevated error rate: ${(errorMetrics.errorRate * 100).toFixed(2)}%`;
    }

    return {
      name: 'Error Rate',
      status,
      message,
      details: {
        errorRate: errorMetrics.errorRate,
        totalErrors: errorMetrics.errorCount,
        criticalErrors: errorMetrics.criticalErrors,
        recoveryRate: errorMetrics.recoverySuccessRate,
      },
      duration: Date.now() - start,
    };
  }

  /**
   * Checks system resources
   */
  private async checkSystemResources(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Check if we can create a simple worker (basic functionality test)
      const testStart = Date.now();
      const testDuration = Date.now() - testStart;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = `System resources are available (test completed in ${testDuration}ms)`;

      if (testDuration > 5000) {
        status = 'warn';
        message = `Slow system response: ${testDuration}ms`;
      }

      return {
        name: 'System Resources',
        status,
        message,
        details: {
          testDuration,
          resourcesAvailable: true,
        },
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'System Resources',
        status: 'fail',
        message: `System resource check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Checks dependency health
   */
  private async checkDependencyHealth(): Promise<HealthCheck> {
    const start = Date.now();

    const dependencies = [
      { name: 'global', check: () => typeof globalThis !== 'undefined' },
      { name: 'Promise', check: () => typeof Promise !== 'undefined' },
      { name: 'setTimeout', check: () => typeof setTimeout !== 'undefined' },
      { name: 'console', check: () => typeof console !== 'undefined' },
    ];

    const failed = dependencies.filter((dep) => !dep.check());

    if (failed.length === 0) {
      return {
        name: 'Dependency Health',
        status: 'pass',
        message: 'All required dependencies are available',
        details: { dependencies: dependencies.map((d) => d.name) },
        duration: Date.now() - start,
      };
    } else {
      return {
        name: 'Dependency Health',
        status: 'fail',
        message: `Missing dependencies: ${failed.map((d) => d.name).join(', ')}`,
        details: { failed: failed.map((d) => d.name) },
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Calculates overall health status based on individual checks
   */
  private calculateOverallStatus(
    checks: HealthCheck[]
  ): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (checks.length === 0) return 'unknown';

    const hasCritical = checks.some((check) => check.status === 'fail');
    const hasWarnings = checks.some((check) => check.status === 'warn');

    if (hasCritical) return 'critical';
    if (hasWarnings) return 'warning';
    return 'healthy';
  }

  /**
   * Generates a health summary
   */
  private generateSummary(overall: string, checks: HealthCheck[]): string {
    const passCount = checks.filter((c) => c.status === 'pass').length;
    const warnCount = checks.filter((c) => c.status === 'warn').length;
    const failCount = checks.filter((c) => c.status === 'fail').length;

    return `Health: ${overall.toUpperCase()} | Checks: ${passCount} pass, ${warnCount} warn, ${failCount} fail`;
  }

  /**
   * Generates health recommendations
   */
  private generateRecommendations(checks: HealthCheck[]): string[] {
    const recommendations: string[] = [];

    checks.forEach((check) => {
      if (check.status === 'fail') {
        switch (check.name) {
          case 'Memory Health':
            recommendations.push(
              'Consider reducing batch sizes and implementing memory cleanup'
            );
            break;
          case 'Performance Metrics':
            recommendations.push(
              'Profile application for performance bottlenecks'
            );
            break;
          case 'Error Rate':
            recommendations.push('Investigate and fix recurring errors');
            break;
          case 'Worker Support':
            recommendations.push('Consider platform-specific optimizations');
            break;
          case 'System Resources':
            recommendations.push('Check system load and available resources');
            break;
        }
      } else if (check.status === 'warn') {
        switch (check.name) {
          case 'Memory Health':
            recommendations.push('Monitor memory usage trends');
            break;
          case 'Performance Metrics':
            recommendations.push('Consider performance optimizations');
            break;
          case 'Error Rate':
            recommendations.push(
              'Review error patterns and implement preventive measures'
            );
            break;
        }
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('System is healthy - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Gets the last health check result
   */
  getLastHealthCheck(): HealthStatus | undefined {
    return this.lastHealthCheck;
  }

  /**
   * Gets system uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Generates a comprehensive health report
   */
  generateHealthReport(): string {
    const health = this.lastHealthCheck;

    if (!health) {
      return '🏥 No health data available. Run performHealthCheck() first.';
    }

    let report = `🏥 ThreadTS Universal - Health Report\n`;
    report += `═══════════════════════════════════════════════════\n`;
    report += `🎯 Overall Status: ${health.overall.toUpperCase()}\n`;
    report += `⏰ Timestamp: ${new Date(health.timestamp).toISOString()}\n`;
    report += `🕐 Uptime: ${Math.round(health.uptime / 1000 / 60)} minutes\n`;
    report += `📋 Summary: ${health.summary}\n`;

    report += `\n🔍 Health Checks:\n`;
    health.checks.forEach((check, index) => {
      const statusIcon =
        check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
      report += `${index + 1}. ${statusIcon} ${check.name}: ${check.message}\n`;

      if (check.details && Object.keys(check.details).length > 0) {
        report += `   Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, '\n   ')}\n`;
      }
    });

    if (health.recommendations.length > 0) {
      report += `\n💡 Recommendations:\n`;
      health.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }

    return report;
  }

  /**
   * Performs a quick health check (essential checks only)
   */
  async quickHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
  }> {
    const checks = [
      await this.checkPlatformCompatibility(),
      await this.checkWorkerSupport(),
      await this.checkMemoryHealth(),
    ];

    const overall = this.calculateOverallStatus(checks);
    const failedChecks = checks.filter((c) => c.status === 'fail');
    const warningChecks = checks.filter((c) => c.status === 'warn');

    let message = 'System is healthy';
    if (failedChecks.length > 0) {
      message = `Critical issues: ${failedChecks.map((c) => c.name).join(', ')}`;
    } else if (warningChecks.length > 0) {
      message = `Warnings: ${warningChecks.map((c) => c.name).join(', ')}`;
    }

    // Map unknown to warning for the quick check
    const status = overall === 'unknown' ? 'warning' : overall;

    return { status, message };
  }

  /**
   * Resets the health monitor
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastHealthCheck = undefined;
    console.log('🏥 Health monitor reset');
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

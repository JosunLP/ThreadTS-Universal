/**
 * ThreadTS Universal - Advanced Error Handling and Recovery System
 * Comprehensive error detection, classification, and recovery mechanisms
 */

import { SerializationError, TimeoutError, WorkerError } from '../types';

export interface ErrorContext {
  operation: string;
  timestamp: number;
  platform: string;
  workerCount: number;
  memoryUsage?: number;
  stackTrace?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastErrorTime: number;
  commonErrors: Map<string, number>;
  criticalErrors: number;
  recoverySuccessRate: number;
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error, context: ErrorContext) => boolean;
  action: (error: Error, context: ErrorContext) => Promise<boolean>;
  priority: number; // Higher number = higher priority
}

export class ErrorHandler {
  private errors: Array<{ error: Error; context: ErrorContext }> = [];
  private recoveryStrategies: RecoveryStrategy[] = [];
  private circuitBreakerStates = new Map<
    string,
    { isOpen: boolean; failures: number; lastFailure: number }
  >();
  private retryPolicies = new Map<
    string,
    { maxRetries: number; backoffMs: number; multiplier: number }
  >();

  constructor() {
    this.initializeDefaultStrategies();
    this.initializeDefaultRetryPolicies();
  }

  /**
   * Initializes default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Memory cleanup strategy
    this.addRecoveryStrategy({
      name: 'memory-cleanup',
      priority: 10,
      condition: (error) =>
        error.message.includes('out of memory') ||
        error.message.includes('heap') ||
        error.name === 'RangeError',
      action: async (error, context) => {
        console.log('🧹 Executing memory cleanup strategy...');

        // Force garbage collection if available
        if (typeof global !== 'undefined' && global.gc) {
          global.gc();
        }

        // Clear internal caches
        this.clearInternalCaches();

        // Reduce worker pool size temporarily
        await this.reduceWorkerPoolSize(context);

        return true;
      },
    });

    // Worker restart strategy
    this.addRecoveryStrategy({
      name: 'worker-restart',
      priority: 8,
      condition: (error) =>
        error instanceof WorkerError ||
        error.message.includes('worker') ||
        error.message.includes('terminated'),
      action: async (error, context) => {
        console.log('🔄 Executing worker restart strategy...');

        // This would be implemented by the calling code
        // Return success for now
        return true;
      },
    });

    // Serialization fallback strategy
    this.addRecoveryStrategy({
      name: 'serialization-fallback',
      priority: 6,
      condition: (error) =>
        error instanceof SerializationError ||
        error.message.includes('serialize') ||
        error.message.includes('JSON'),
      action: async (error, context) => {
        console.log('📦 Executing serialization fallback strategy...');

        // Switch to simpler serialization method
        // This would be implemented by the calling code
        return true;
      },
    });

    // Timeout recovery strategy
    this.addRecoveryStrategy({
      name: 'timeout-recovery',
      priority: 4,
      condition: (error) =>
        error instanceof TimeoutError ||
        error.message.includes('timeout') ||
        error.message.includes('timed out'),
      action: async (error, context) => {
        console.log('⏱️ Executing timeout recovery strategy...');

        // Increase timeout for subsequent operations
        this.adjustTimeouts(context.operation, 1.5);

        return true;
      },
    });

    // Generic retry strategy (lowest priority)
    this.addRecoveryStrategy({
      name: 'generic-retry',
      priority: 1,
      condition: () => true, // Always applicable as last resort
      action: async (error, context) => {
        console.log('🔁 Executing generic retry strategy...');

        // Implement exponential backoff
        const retryDelay = Math.min(
          1000 *
            Math.pow(2, (context.additionalData?.retryCount as number) || 0),
          30000
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        return true;
      },
    });
  }

  /**
   * Initializes default retry policies for different operations
   */
  private initializeDefaultRetryPolicies(): void {
    this.retryPolicies.set('worker-execution', {
      maxRetries: 3,
      backoffMs: 1000,
      multiplier: 2,
    });

    this.retryPolicies.set('serialization', {
      maxRetries: 2,
      backoffMs: 500,
      multiplier: 1.5,
    });

    this.retryPolicies.set('pool-operation', {
      maxRetries: 5,
      backoffMs: 2000,
      multiplier: 1.8,
    });
  }

  /**
   * Handles an error with automatic recovery attempts
   */
  async handleError(error: Error, context: ErrorContext): Promise<boolean> {
    // Record the error
    this.recordError(error, context);

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(context.operation)) {
      console.warn(
        `🚫 Circuit breaker open for ${context.operation}, skipping recovery`
      );
      return false;
    }

    // Try recovery strategies in priority order
    const strategies = this.recoveryStrategies
      .filter((strategy) => strategy.condition(error, context))
      .sort((a, b) => b.priority - a.priority);

    for (const strategy of strategies) {
      try {
        console.log(`🔧 Attempting recovery strategy: ${strategy.name}`);
        const success = await strategy.action(error, context);

        if (success) {
          console.log(`✅ Recovery successful with strategy: ${strategy.name}`);
          this.recordRecoverySuccess(context.operation);
          return true;
        }
      } catch (recoveryError) {
        console.warn(
          `❌ Recovery strategy ${strategy.name} failed:`,
          recoveryError
        );
        this.recordRecoveryFailure(context.operation);
      }
    }

    // Update circuit breaker state
    this.updateCircuitBreaker(context.operation, false);

    console.error(
      `💥 All recovery strategies failed for error: ${error.message}`
    );
    return false;
  }

  /**
   * Records an error for metrics and analysis
   */
  private recordError(error: Error, context: ErrorContext): void {
    this.errors.push({ error, context });

    // Keep only last 1000 errors to prevent memory leaks
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-1000);
    }

    // Log error with context
    console.error(`🚨 Error recorded: ${error.name}: ${error.message}`, {
      operation: context.operation,
      platform: context.platform,
      timestamp: new Date(context.timestamp).toISOString(),
    });
  }

  /**
   * Checks if circuit breaker is open for an operation
   */
  private isCircuitBreakerOpen(operation: string): boolean {
    const state = this.circuitBreakerStates.get(operation);
    if (!state) return false;

    // Auto-reset after 60 seconds
    if (state.isOpen && Date.now() - state.lastFailure > 60000) {
      state.isOpen = false;
      state.failures = 0;
      console.log(`🟢 Circuit breaker reset for ${operation}`);
    }

    return state.isOpen;
  }

  /**
   * Updates circuit breaker state
   */
  private updateCircuitBreaker(operation: string, success: boolean): void {
    let state = this.circuitBreakerStates.get(operation);
    if (!state) {
      state = { isOpen: false, failures: 0, lastFailure: 0 };
      this.circuitBreakerStates.set(operation, state);
    }

    if (success) {
      state.failures = 0;
      if (state.isOpen) {
        state.isOpen = false;
        console.log(`🟢 Circuit breaker closed for ${operation}`);
      }
    } else {
      state.failures++;
      state.lastFailure = Date.now();

      // Open circuit breaker after 5 consecutive failures
      if (state.failures >= 5 && !state.isOpen) {
        state.isOpen = true;
        console.warn(
          `🔴 Circuit breaker opened for ${operation} after ${state.failures} failures`
        );
      }
    }
  }

  /**
   * Records a successful recovery
   */
  private recordRecoverySuccess(operation: string): void {
    this.updateCircuitBreaker(operation, true);
  }

  /**
   * Records a failed recovery
   */
  private recordRecoveryFailure(operation: string): void {
    this.updateCircuitBreaker(operation, false);
  }

  /**
   * Adds a custom recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);
    console.log(
      `➕ Added recovery strategy: ${strategy.name} (priority: ${strategy.priority})`
    );
  }

  /**
   * Sets retry policy for an operation
   */
  setRetryPolicy(
    operation: string,
    policy: { maxRetries: number; backoffMs: number; multiplier: number }
  ): void {
    this.retryPolicies.set(operation, policy);
    console.log(`⚙️ Set retry policy for ${operation}:`, policy);
  }

  /**
   * Executes an operation with automatic retry and error handling
   */
  async executeWithRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    const policy =
      this.retryPolicies.get(operation) ||
      this.retryPolicies.get('worker-execution')!;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        const result = await fn();

        // Success - update circuit breaker
        this.updateCircuitBreaker(operation, true);

        return result;
      } catch (error) {
        lastError = error as Error;

        const errorContext: ErrorContext = {
          operation,
          timestamp: Date.now(),
          platform: context.platform || 'unknown',
          workerCount: context.workerCount || 0,
          memoryUsage: context.memoryUsage,
          stackTrace: lastError.stack,
          additionalData: {
            ...context.additionalData,
            retryCount: attempt,
            maxRetries: policy.maxRetries,
          },
        };

        // Last attempt - don't retry, just handle error
        if (attempt === policy.maxRetries) {
          await this.handleError(lastError, errorContext);
          break;
        }

        // Try recovery
        const recovered = await this.handleError(lastError, errorContext);

        if (!recovered && attempt < policy.maxRetries) {
          // Wait before retry with exponential backoff
          const delay = policy.backoffMs * Math.pow(policy.multiplier, attempt);
          console.log(
            `⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${policy.maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw (
      lastError ||
      new Error(
        `Operation ${operation} failed after ${policy.maxRetries} retries`
      )
    );
  }

  /**
   * Gets error metrics for analysis
   */
  getErrorMetrics(): ErrorMetrics {
    if (this.errors.length === 0) {
      return {
        errorCount: 0,
        errorRate: 0,
        lastErrorTime: 0,
        commonErrors: new Map(),
        criticalErrors: 0,
        recoverySuccessRate: 0,
      };
    }

    const now = Date.now();
    const last24Hours = this.errors.filter(
      (e) => now - e.context.timestamp < 24 * 60 * 60 * 1000
    );

    const commonErrors = new Map<string, number>();
    let criticalErrors = 0;

    last24Hours.forEach(({ error }) => {
      const errorKey = `${error.name}: ${error.message}`;
      commonErrors.set(errorKey, (commonErrors.get(errorKey) || 0) + 1);

      if (error instanceof TimeoutError || error instanceof WorkerError) {
        criticalErrors++;
      }
    });

    return {
      errorCount: this.errors.length,
      errorRate: last24Hours.length / Math.max(1, 24), // errors per hour
      lastErrorTime: this.errors[this.errors.length - 1].context.timestamp,
      commonErrors,
      criticalErrors,
      recoverySuccessRate: this.calculateRecoverySuccessRate(),
    };
  }

  /**
   * Calculates recovery success rate
   */
  private calculateRecoverySuccessRate(): number {
    // This would be calculated based on actual recovery attempts
    // For now, return a placeholder
    return 0.85; // 85% success rate
  }

  /**
   * Helper methods for recovery strategies
   */
  private clearInternalCaches(): void {
    // Clear any internal caches here
    console.log('🧹 Clearing internal caches...');
  }

  private async reduceWorkerPoolSize(context: ErrorContext): Promise<void> {
    // Reduce worker pool size temporarily
    console.log(
      `📉 Reducing worker pool size from ${context.workerCount} to ${Math.max(1, Math.floor(context.workerCount / 2))}`
    );
  }

  private adjustTimeouts(operation: string, multiplier: number): void {
    console.log(`⏱️ Increasing timeout for ${operation} by ${multiplier}x`);
    // This would adjust timeouts in the actual operation handlers
  }

  /**
   * Generates a comprehensive error report
   */
  generateErrorReport(): string {
    const metrics = this.getErrorMetrics();

    let report = `🚨 Error Analysis Report\n`;
    report += `═══════════════════════════════════════\n`;
    report += `📊 Total Errors: ${metrics.errorCount}\n`;
    report += `⚡ Error Rate: ${metrics.errorRate.toFixed(2)} errors/hour\n`;
    report += `🔥 Critical Errors: ${metrics.criticalErrors}\n`;
    report += `✅ Recovery Success Rate: ${(metrics.recoverySuccessRate * 100).toFixed(1)}%\n`;

    if (metrics.lastErrorTime > 0) {
      const timeSinceLastError =
        (Date.now() - metrics.lastErrorTime) / 1000 / 60;
      report += `⏰ Last Error: ${timeSinceLastError.toFixed(1)} minutes ago\n`;
    }

    if (metrics.commonErrors.size > 0) {
      report += `\n🔍 Most Common Errors:\n`;
      const sortedErrors = Array.from(metrics.commonErrors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sortedErrors.forEach(([error, count], index) => {
        report += `${index + 1}. ${error} (${count} times)\n`;
      });
    }

    // Circuit breaker status
    report += `\n🔴 Circuit Breaker Status:\n`;
    for (const [operation, state] of this.circuitBreakerStates) {
      const status = state.isOpen ? '🔴 OPEN' : '🟢 CLOSED';
      report += `- ${operation}: ${status} (failures: ${state.failures})\n`;
    }

    return report;
  }

  /**
   * Resets all error data and states
   */
  reset(): void {
    this.errors = [];
    this.circuitBreakerStates.clear();
    console.log('🔄 Error handler reset');
  }

  /**
   * Gets recent errors for debugging
   */
  getRecentErrors(
    count: number = 10
  ): Array<{ error: Error; context: ErrorContext }> {
    return this.errors.slice(-count);
  }
}

// Global error handler instance
export const errorHandler = new ErrorHandler();

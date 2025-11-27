/**
 * ThreadTS Universal - Abstract Base Worker Adapter
 *
 * Provides common functionality for all platform-specific worker adapters.
 * This base class implements the Template Method design pattern,
 * allowing subclasses to customize specific behaviors while sharing
 * common logic for worker management, error handling, and lifecycle.
 *
 * @module adapters/base
 * @author ThreadTS Universal Team
 */

import {
  Platform,
  SerializableFunction,
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
  WorkerInstance,
} from '../types';
import { getHighResTimestamp, getOptimalThreadCount } from '../utils/platform';
import { createWorkerScript } from '../utils/serialization';

/**
 * Configuration options for base worker instance.
 * These options control common behavior across all platforms.
 */
export interface BaseWorkerConfig {
  /** Maximum time in ms to wait for worker initialization */
  initTimeout?: number;
  /** Whether to automatically cleanup on error */
  autoCleanupOnError?: boolean;
  /** Whether to track execution metrics */
  trackMetrics?: boolean;
}

/**
 * Execution metrics collected during worker operation.
 * Useful for monitoring and debugging performance issues.
 */
export interface WorkerExecutionMetrics {
  /** Start timestamp of the execution */
  startTime: number;
  /** End timestamp of the execution */
  endTime: number;
  /** Total execution duration in milliseconds */
  duration: number;
  /** Whether the execution was successful */
  success: boolean;
  /** Error message if execution failed */
  errorMessage?: string;
}

/** Counter for unique worker ID generation with overflow protection */
let workerIdCounter = 0;

/**
 * Generates a unique worker ID using a counter-based approach.
 * More reliable than pure random generation for high-concurrency scenarios.
 * Includes overflow protection for long-running applications.
 *
 * @param platform - The platform identifier
 * @returns A unique worker ID string
 */
function generateWorkerId(platform: Platform): string {
  // Increment with overflow protection using modulo to prevent reaching Number.MAX_SAFE_INTEGER
  workerIdCounter = (workerIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  const counter = workerIdCounter;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${platform}-worker-${counter}-${timestamp}-${random}`;
}

/**
 * Abstract base class for worker instances across all platforms.
 *
 * Implements common functionality like:
 * - Execution state tracking
 * - Timeout handling
 * - Abort signal management
 * - Metrics collection
 *
 * Subclasses must implement platform-specific worker creation and cleanup.
 *
 * @abstract
 * @implements {WorkerInstance}
 *
 * @example
 * ```typescript
 * class MyWorkerInstance extends AbstractWorkerInstance {
 *   protected async createPlatformWorker(script: string): Promise<void> {
 *     // Platform-specific worker creation
 *   }
 *
 *   protected async cleanupPlatformWorker(): Promise<void> {
 *     // Platform-specific cleanup
 *   }
 *
 *   protected async postMessageToWorker(data: unknown): Promise<ThreadResult<unknown>> {
 *     // Platform-specific message passing
 *   }
 * }
 * ```
 */
export abstract class AbstractWorkerInstance implements WorkerInstance {
  /** Unique identifier for this worker instance */
  readonly id: string;

  /** Whether the worker has been terminated */
  protected isTerminated = false;

  /** Whether the worker is currently executing a task */
  protected isExecuting = false;

  /** Collection of execution metrics for monitoring */
  protected executionHistory: WorkerExecutionMetrics[] = [];

  /** Configuration for this worker instance */
  protected config: Required<BaseWorkerConfig>;

  /**
   * Creates a new abstract worker instance.
   *
   * @param platform - The platform identifier (browser, node, deno, bun)
   * @param config - Optional configuration overrides
   */
  constructor(
    protected readonly platform: Platform,
    config: BaseWorkerConfig = {}
  ) {
    // Generate unique worker ID using counter-based approach for reliability
    this.id = generateWorkerId(platform);

    // Apply default configuration with user overrides
    this.config = {
      initTimeout: config.initTimeout ?? 30000,
      autoCleanupOnError: config.autoCleanupOnError ?? true,
      trackMetrics: config.trackMetrics ?? true,
    };
  }

  /**
   * Executes a function in the worker thread.
   *
   * This method handles common concerns like:
   * - State validation (terminated, already executing)
   * - Timeout management
   * - Abort signal handling
   * - Metrics collection
   *
   * @template T - The expected return type
   * @param fn - The function to execute in the worker
   * @param data - The data to pass to the function
   * @param options - Execution options (timeout, signal, etc.)
   * @returns Promise resolving to the execution result
   * @throws {WorkerError} If worker is terminated or already executing
   */
  async execute<T = unknown>(
    fn: SerializableFunction,
    data: unknown,
    options: ThreadOptions = {}
  ): Promise<ThreadResult<T>> {
    // Validate worker state before execution
    this.validateState();

    this.isExecuting = true;
    const startTime = getHighResTimestamp();

    try {
      // Create the worker script from function and data
      const workerScript = createWorkerScript(fn, data, {
        timeout: options.timeout,
      });

      // Execute with timeout and abort handling
      const result = await this.executeWithControls<T>(
        workerScript,
        data,
        options,
        startTime
      );

      // Record successful execution metrics
      this.recordMetrics(startTime, true);

      return result;
    } catch (error) {
      // Record failed execution metrics
      this.recordMetrics(
        startTime,
        false,
        error instanceof Error ? error.message : String(error)
      );

      // Auto-cleanup on error if configured
      if (this.config.autoCleanupOnError) {
        await this.cleanupOnError();
      }

      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Terminates the worker and releases resources.
   *
   * After termination, the worker instance cannot be reused.
   * This method is idempotent - calling it multiple times is safe.
   */
  async terminate(): Promise<void> {
    if (this.isTerminated) {
      return; // Already terminated, nothing to do
    }

    // Perform platform-specific cleanup
    await this.cleanupPlatformWorker();

    this.isTerminated = true;
    this.executionHistory = []; // Clear metrics to free memory
  }

  /**
   * Checks if the worker is currently idle (not executing and not terminated).
   *
   * @returns true if the worker can accept new tasks
   */
  isIdle(): boolean {
    return !this.isExecuting && !this.isTerminated;
  }

  /**
   * Gets the execution history for this worker.
   * Useful for monitoring and debugging.
   *
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Array of execution metrics in chronological order (oldest first)
   */
  getExecutionHistory(limit = 10): WorkerExecutionMetrics[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Gets the average execution time for this worker.
   *
   * @returns Average execution time in milliseconds, or 0 if no history
   */
  getAverageExecutionTime(): number {
    if (this.executionHistory.length === 0) {
      return 0;
    }

    const totalDuration = this.executionHistory.reduce(
      (sum, metric) => sum + metric.duration,
      0
    );

    return totalDuration / this.executionHistory.length;
  }

  /**
   * Gets the success rate for this worker.
   *
   * @returns Success rate as a decimal (0.0 to 1.0), or 1.0 if no history
   */
  getSuccessRate(): number {
    if (this.executionHistory.length === 0) {
      return 1.0;
    }

    const successCount = this.executionHistory.filter((m) => m.success).length;
    return successCount / this.executionHistory.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Protected Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates that the worker is in a valid state for execution.
   *
   * @throws {WorkerError} If worker is terminated or already executing
   */
  protected validateState(): void {
    if (this.isTerminated) {
      throw new WorkerError('Worker has been terminated');
    }

    if (this.isExecuting) {
      throw new WorkerError('Worker is already executing a task');
    }
  }

  /**
   * Executes with timeout and abort signal handling.
   * Wraps the platform-specific execution with common controls.
   *
   * @template T - The expected return type
   * @param workerScript - The serialized worker script
   * @param data - The data to pass to the worker
   * @param options - Execution options
   * @param startTime - The execution start timestamp
   * @returns Promise resolving to the execution result
   */
  protected async executeWithControls<T>(
    workerScript: string,
    data: unknown,
    options: ThreadOptions,
    startTime: number
  ): Promise<ThreadResult<T>> {
    // Create a promise that handles the actual execution
    const executionPromise = this.performPlatformExecution<T>(
      workerScript,
      data,
      options,
      startTime
    );

    // Wrap with abort signal if provided
    const abortPromise = options.signal
      ? this.createAbortPromise<T>(options.signal)
      : null;

    // Wrap with timeout if provided
    const timeoutPromise = options.timeout
      ? this.createTimeoutPromise<T>(options.timeout)
      : null;

    // Race all promises
    const promises: Promise<ThreadResult<T>>[] = [executionPromise];
    if (abortPromise) promises.push(abortPromise);
    if (timeoutPromise) promises.push(timeoutPromise);

    return Promise.race(promises);
  }

  /**
   * Creates a promise that rejects when the abort signal is triggered.
   *
   * @template T - The expected return type
   * @param signal - The abort signal to monitor
   * @returns Promise that rejects on abort
   */
  protected createAbortPromise<T>(
    signal: AbortSignal
  ): Promise<ThreadResult<T>> {
    return new Promise<ThreadResult<T>>((_, reject) => {
      if (signal.aborted) {
        reject(new WorkerError('Operation was aborted'));
        return;
      }

      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        reject(new WorkerError('Operation was aborted'));
      };

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Creates a promise that rejects after the specified timeout.
   *
   * @template T - The expected return type
   * @param timeout - Timeout in milliseconds
   * @returns Promise that rejects on timeout
   */
  protected createTimeoutPromise<T>(timeout: number): Promise<ThreadResult<T>> {
    return new Promise<ThreadResult<T>>((_, reject) => {
      setTimeout(() => {
        reject(new WorkerError(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Records execution metrics for monitoring.
   *
   * @param startTime - The execution start timestamp
   * @param success - Whether the execution was successful
   * @param errorMessage - Error message if execution failed
   */
  protected recordMetrics(
    startTime: number,
    success: boolean,
    errorMessage?: string
  ): void {
    if (!this.config.trackMetrics) {
      return;
    }

    const endTime = getHighResTimestamp();
    const metrics: WorkerExecutionMetrics = {
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      errorMessage,
    };

    this.executionHistory.push(metrics);

    // Keep only last 100 metrics to prevent memory growth
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
  }

  /**
   * Handles cleanup after an error occurs.
   * Called when autoCleanupOnError is enabled.
   */
  protected async cleanupOnError(): Promise<void> {
    // Default implementation: just clean up the platform worker
    // Subclasses can override for more specific cleanup
    try {
      await this.cleanupPlatformWorker();
    } catch {
      // Ignore cleanup errors
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Abstract Methods - Must be implemented by subclasses
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Performs the platform-specific worker execution.
   *
   * @template T - The expected return type
   * @param workerScript - The serialized worker script
   * @param data - The data to pass to the worker
   * @param options - Execution options
   * @param startTime - The execution start timestamp
   * @returns Promise resolving to the execution result
   *
   * @abstract
   */
  protected abstract performPlatformExecution<T>(
    workerScript: string,
    data: unknown,
    options: ThreadOptions,
    startTime: number
  ): Promise<ThreadResult<T>>;

  /**
   * Cleans up platform-specific worker resources.
   *
   * @abstract
   */
  protected abstract cleanupPlatformWorker(): Promise<void>;
}

/**
 * Abstract base class for worker adapters.
 *
 * Provides common factory pattern implementation for creating workers.
 * Subclasses implement platform-specific worker creation.
 *
 * @abstract
 * @implements {WorkerAdapter}
 */
export abstract class AbstractWorkerAdapter implements WorkerAdapter {
  /** The platform this adapter supports */
  abstract readonly platform: Platform;

  /**
   * Creates a new worker instance for this platform.
   *
   * @param script - Initial script (may be empty, actual script provided during execution)
   * @returns Promise resolving to the new worker instance
   */
  abstract createWorker(script: string): Promise<WorkerInstance>;

  /**
   * Terminates a worker instance and releases resources.
   *
   * @param worker - The worker instance to terminate
   */
  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  /**
   * Checks if this adapter is supported in the current environment.
   *
   * @returns true if workers can be created in this environment
   */
  abstract isSupported(): boolean;

  /**
   * Gets the recommended number of workers for this platform.
   * Uses the optimal thread count from platform utilities for
   * cross-platform consistency.
   *
   * @returns Recommended worker count based on hardware and platform
   */
  getRecommendedWorkerCount(): number {
    // Use platform utilities for consistent cross-platform behavior
    return getOptimalThreadCount();
  }
}

/**
 * Creates a standardized error message for worker operations.
 * Ensures consistent error formatting across all adapters.
 *
 * @param operation - The operation that failed
 * @param platform - The platform where the error occurred
 * @param originalError - The original error if available
 * @returns Formatted error message
 */
export function createWorkerErrorMessage(
  operation: string,
  platform: Platform,
  originalError?: Error
): string {
  let message = `[${platform}] Worker ${operation} failed`;

  if (originalError) {
    message += `: ${originalError.message}`;
  }

  return message;
}

/**
 * Type guard to check if an object is a WorkerInstance.
 *
 * @param obj - The object to check
 * @returns true if the object implements WorkerInstance
 */
export function isWorkerInstance(obj: unknown): obj is WorkerInstance {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const worker = obj as Partial<WorkerInstance>;
  return (
    typeof worker.id === 'string' &&
    typeof worker.execute === 'function' &&
    typeof worker.terminate === 'function' &&
    typeof worker.isIdle === 'function'
  );
}

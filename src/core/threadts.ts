/**
 * ThreadTS Universal - Core ThreadTS Class
 *
 * The main entry point for parallel computing in ThreadTS Universal.
 * Provides a simple, powerful API for executing functions in parallel
 * across all JavaScript runtimes (Browser, Node.js, Deno, Bun).
 *
 * @module core/threadts
 * @author ThreadTS Universal Team
 *
 * @example
 * ```typescript
 * import threadts from 'threadts-universal';
 *
 * // Simple parallel execution
 * const result = await threadts.run((x) => x * 2, 21);
 * console.log(result); // 42
 *
 * // Parallel array processing
 * const squares = await threadts.map([1, 2, 3], (x) => x * x);
 * console.log(squares); // [1, 4, 9]
 * ```
 */

import type {
  MapOptions,
  SerializableData,
  SerializableFunction,
  TaskResult,
  ThreadConfig,
  ThreadOptions,
  ThreadTask,
} from '../types';
import {
  ThreadError,
  TimeoutError,
  WorkerError,
} from '../types';
import { PlatformUtils } from '../utils/platform';
// Note: SerializationError must be imported directly from types module (not re-exported by validation)
import {
  validateFunction,
  validateSerializable,
  toPositiveInt,
} from '../utils/validation';

/**
 * Event map for ThreadTS event system.
 * Defines all events that can be emitted by the ThreadTS instance.
 */
interface ThreadEventMap {
  /** Emitted when a task completes successfully */
  'task-complete': {
    taskId: string;
    result: SerializableData;
    duration: number;
  };
  /** Emitted when a task fails with an error */
  'task-error': { taskId: string; error: string; duration: number };
  /** Emitted when the worker pool size changes */
  'pool-resize': { oldSize: number; newSize: number };
  /** Emitted when a new worker is spawned */
  'worker-spawn': { workerId: string; poolSize: number };
  /** Emitted when a worker is terminated */
  'worker-terminate': { workerId: string; poolSize: number };
}

/** Type for event listener functions */
type ThreadEventListener<K extends keyof ThreadEventMap> = (
  detail: ThreadEventMap[K]
) => void;

/** Internal key used to identify args payloads */
const INTERNAL_ARGS_KEY = '__THREADTS_ARGS__' as const;

/** Internal type for passing multiple arguments to workers */
type InternalArgsPayload = {
  [INTERNAL_ARGS_KEY]: unknown[];
};

/**
 * Legacy task format for backwards compatibility.
 * Supports both 'fn' and 'func' property names.
 */
type LegacyTask = {
  fn?: SerializableFunction;
  func?: SerializableFunction;
  data?: SerializableData;
  options?: ThreadOptions;
};

/**
 * Normalized task format with required function.
 */
interface NormalizedTask {
  fn: SerializableFunction;
  data?: SerializableData;
  options?: ThreadOptions;
}

/**
 * ThreadTS - The main class for parallel computing.
 *
 * Implements a singleton pattern for resource sharing while allowing
 * configuration customization. Provides methods for executing functions
 * in parallel, including map, filter, reduce, and batch operations.
 *
 * @extends EventTarget - Enables event-based communication
 *
 * @example
 * ```typescript
 * // Get the singleton instance
 * const instance = ThreadTS.getInstance();
 *
 * // Execute a function in parallel
 * const result = await instance.run((x) => x * 2, 21);
 *
 * // Process arrays in parallel
 * const doubled = await instance.map([1, 2, 3], (x) => x * 2);
 * ```
 */

export class ThreadTS extends EventTarget {
  private static _instance: ThreadTS | null = null;
  private config!: ThreadConfig;
  private isReady: boolean = false;
  private taskCounter: number = 0;
  private completedTasks: number = 0;
  private failedTasks: number = 0;
  private totalExecutionTime: number = 0;
  private eventListeners: Map<
    keyof ThreadEventMap,
    Set<ThreadEventListener<keyof ThreadEventMap>>
  > = new Map();

  constructor(config: Partial<ThreadConfig> = {}) {
    super();

    if (ThreadTS._instance && Object.keys(config).length === 0) {
      return ThreadTS._instance;
    }

    this.config = this.mergeConfig(config);

    if (!ThreadTS._instance) {
      ThreadTS._instance = this;
    }

    this.initialize();
  }

  private mergeConfig(userConfig: Partial<ThreadConfig>): ThreadConfig {
    const defaultConfig: ThreadConfig = {
      poolSize: PlatformUtils.getOptimalWorkerCount(),
      timeout: 30000,
      retries: 2,
      autoResize: true,
      debug: false,
      serializationStrategy: 'auto',
      enableDecorators: true,
      enableMetrics: false,
      maxQueueSize: 1000,
      workerIdleTimeout: 60000,
      taskPriority: 'normal',
    };

    return { ...defaultConfig, ...userConfig };
  }

  static getInstance(config?: Partial<ThreadConfig>): ThreadTS {
    if (!ThreadTS._instance) {
      ThreadTS._instance = new ThreadTS(config);
    }
    return ThreadTS._instance;
  }

  private async initialize(): Promise<void> {
    try {
      this.isReady = true;
      this.emitEvent('pool-resize', {
        oldSize: 0,
        newSize: this.config.poolSize,
      });
    } catch (error) {
      console.error('Failed to initialize ThreadTS:', error);
      throw error;
    }
  }

  private emitEvent<K extends keyof ThreadEventMap>(
    type: K,
    detail: ThreadEventMap[K]
  ): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          (listener as ThreadEventListener<K>)(detail);
        } catch (error) {
          if (this.config.debug) {
            console.error(`Error in event listener for ${type}:`, error);
          }
        }
      });
    }
  }

  on<K extends keyof ThreadEventMap>(
    event: K,
    listener: ThreadEventListener<K>
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners
      .get(event)!
      .add(listener as ThreadEventListener<keyof ThreadEventMap>);
  }

  off<K extends keyof ThreadEventMap>(
    event: K,
    listener: ThreadEventListener<K>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as ThreadEventListener<keyof ThreadEventMap>);
    }
  }

  private isArgsPayload(value: unknown): value is InternalArgsPayload {
    return (
      typeof value === 'object' &&
      value !== null &&
      INTERNAL_ARGS_KEY in (value as Record<string, unknown>) &&
      Array.isArray((value as Record<string, unknown>)[INTERNAL_ARGS_KEY])
    );
  }

  private createArgsPayload(...args: unknown[]): InternalArgsPayload {
    return {
      [INTERNAL_ARGS_KEY]: args,
    };
  }

  private prepareArguments(
    data?: SerializableData | InternalArgsPayload
  ): unknown[] {
    if (typeof data === 'undefined') {
      return [];
    }

    if (this.isArgsPayload(data)) {
      return [...data[INTERNAL_ARGS_KEY]];
    }

    return [data];
  }

  private async executeWithControls<T>(
    func: SerializableFunction,
    args: unknown[],
    options: ThreadOptions
  ): Promise<T> {
    if (options.signal?.aborted) {
      throw new WorkerError('Operation was aborted before execution');
    }

    const execution = Promise.resolve().then(() => func(...args)) as Promise<T>;
    const controlled = this.wrapWithAbort(execution, options.signal);

    if (typeof options.timeout === 'number') {
      return this.withTimeout(controlled, options.timeout);
    }

    return controlled;
  }

  private wrapWithAbort<T>(
    promise: Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    if (!signal) {
      return promise;
    }

    if (signal.aborted) {
      return Promise.reject(new WorkerError('Operation was aborted'));
    }

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        reject(new WorkerError('Operation was aborted'));
      };

      signal.addEventListener('abort', onAbort, { once: true });

      promise.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      );
    });
  }

  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    if (timeout <= 0) {
      return promise;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new TimeoutError(timeout));
      }, timeout);

      promise.then(
        (value) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          resolve(value);
        },
        (error) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          reject(error);
        }
      );
    });
  }

  private normalizeTask(task: ThreadTask | LegacyTask): NormalizedTask {
    const candidateFn =
      typeof task.fn === 'function'
        ? task.fn
        : typeof (task as LegacyTask).func === 'function'
          ? (task as LegacyTask).func
          : undefined;

    if (typeof candidateFn !== 'function') {
      throw new ThreadError(
        'Invalid task definition: missing function',
        'INVALID_TASK'
      );
    }

    return {
      fn: candidateFn,
      data: task.data,
      options: task.options,
    };
  }

  async run<T = unknown>(
    func: SerializableFunction,
    data?: SerializableData | InternalArgsPayload,
    options: ThreadOptions = {}
  ): Promise<T> {
    if (!this.isReady) {
      await this.initialize();
    }

    // Validate the function using the utility
    validateFunction(func, 'func');

    const taskId = this.generateTaskId();
    const startTime = PlatformUtils.getHighResTimestamp();
    const args = this.prepareArguments(data);

    // Validate each argument for serializability
    for (const arg of args) {
      validateSerializable(arg);
    }

    const maxRetries = Math.max(
      0,
      options.maxRetries ?? this.config.retries ?? 0
    );
    let attempt = 0;

    // Retry loop with configurable attempts
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await this.executeWithControls<T>(func, args, options);

        const duration = PlatformUtils.getHighResTimestamp() - startTime;
        this.completedTasks += 1;
        this.totalExecutionTime += duration;

        this.emitEvent('task-complete', {
          taskId,
          result: result as SerializableData,
          duration,
        });

        return result;
      } catch (error) {
        if (attempt >= maxRetries) {
          const duration = PlatformUtils.getHighResTimestamp() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this.failedTasks += 1;
          this.emitEvent('task-error', {
            taskId,
            error: errorMessage,
            duration,
          });

          throw error;
        }

        attempt += 1;

        if (this.config.debug) {
          console.warn(
            `ThreadTS retrying task ${taskId} (attempt ${attempt} of ${maxRetries})`,
            error
          );
        }
      }
    }
  }

  async map<T, R = T>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<R[]> {
    if (!array.length) {
      return [];
    }

    const { batchSize = array.length, ...runOptions } = options;
    const executionOptions: ThreadOptions = { ...runOptions };
    const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
    const results: R[] = [];

    for (let index = 0; index < array.length; index += normalizedBatchSize) {
      const chunk = array.slice(index, index + normalizedBatchSize);
      const chunkResults = await Promise.all(
        chunk.map((item, offset) =>
          this.run<R>(
            func,
            this.createArgsPayload(item, index + offset, array),
            executionOptions
          )
        )
      );
      results.push(...chunkResults);
    }

    return results;
  }

  async filter<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<T[]> {
    if (!array.length) {
      return [];
    }

    const results = await this.map<T, boolean>(array, predicate, options);
    return array.filter((_, index) => Boolean(results[index]));
  }

  async reduce<T, R>(
    array: T[],
    reducer: SerializableFunction,
    initialValue: R,
    options: ThreadOptions = {}
  ): Promise<R> {
    let accumulator = initialValue;

    if (!array.length) {
      return accumulator;
    }

    for (let index = 0; index < array.length; index++) {
      accumulator = await this.run<R>(
        reducer,
        this.createArgsPayload(accumulator, array[index], index, array),
        options
      );
    }

    return accumulator;
  }

  /**
   * Iterates over an array, executing the function for each element.
   * Similar to Array.prototype.forEach but runs in parallel.
   *
   * @template T - The type of array elements
   * @param array - The array to iterate over
   * @param func - Function to execute for each element: (item, index, array) => void
   * @param options - Execution options including batchSize
   *
   * @example
   * ```typescript
   * await threadts.forEach([1, 2, 3], (item) => {
   *   console.log(item);
   * });
   * ```
   */
  async forEach<T>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<void> {
    await this.map<T, void>(array, func, options);
  }

  /**
   * Finds the first element that satisfies the predicate function.
   * Similar to Array.prototype.find but processes elements in parallel batches.
   *
   * Note: Due to parallel processing, this may check more elements than
   * a sequential find, but returns the first matching element by index.
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param predicate - Function to test each element: (item, index, array) => boolean
   * @param options - Execution options including batchSize
   * @returns The first element that satisfies the predicate, or undefined
   *
   * @example
   * ```typescript
   * const found = await threadts.find(
   *   [1, 2, 3, 4, 5],
   *   (x) => x > 3
   * );
   * console.log(found); // 4
   * ```
   */
  async find<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<T | undefined> {
    if (!array.length) {
      return undefined;
    }

    // Process in batches to allow early termination
    // Default to smaller batch size (10) for better early termination behavior
    const batchSize = toPositiveInt(options.batchSize, Math.min(array.length, 10));
    const executionOptions: ThreadOptions = { ...options };

    for (let i = 0; i < array.length; i += batchSize) {
      const chunk = array.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map((item, offset) =>
          this.run<boolean>(
            predicate,
            this.createArgsPayload(item, i + offset, array),
            executionOptions
          )
        )
      );

      // Find the first true result in this batch
      const foundIndex = results.findIndex((result) => Boolean(result));
      if (foundIndex !== -1) {
        return chunk[foundIndex];
      }
    }

    return undefined;
  }

  /**
   * Finds the index of the first element that satisfies the predicate.
   * Similar to Array.prototype.findIndex but processes in parallel batches.
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param predicate - Function to test each element: (item, index, array) => boolean
   * @param options - Execution options including batchSize
   * @returns The index of the first matching element, or -1 if not found
   *
   * @example
   * ```typescript
   * const index = await threadts.findIndex(
   *   [1, 2, 3, 4, 5],
   *   (x) => x > 3
   * );
   * console.log(index); // 3
   * ```
   */
  async findIndex<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<number> {
    if (!array.length) {
      return -1;
    }

    // Default to smaller batch size (10) for better early termination behavior
    const batchSize = toPositiveInt(options.batchSize, Math.min(array.length, 10));
    const executionOptions: ThreadOptions = { ...options };

    for (let i = 0; i < array.length; i += batchSize) {
      const chunk = array.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map((item, offset) =>
          this.run<boolean>(
            predicate,
            this.createArgsPayload(item, i + offset, array),
            executionOptions
          )
        )
      );

      const foundIndex = results.findIndex((result) => Boolean(result));
      if (foundIndex !== -1) {
        return i + foundIndex;
      }
    }

    return -1;
  }

  /**
   * Tests whether at least one element satisfies the predicate.
   * Similar to Array.prototype.some but processes in parallel batches.
   *
   * @template T - The type of array elements
   * @param array - The array to test
   * @param predicate - Function to test each element: (item, index, array) => boolean
   * @param options - Execution options including batchSize
   * @returns true if at least one element passes the test
   *
   * @example
   * ```typescript
   * const hasEven = await threadts.some(
   *   [1, 3, 5, 6, 7],
   *   (x) => x % 2 === 0
   * );
   * console.log(hasEven); // true
   * ```
   */
  async some<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<boolean> {
    if (!array.length) {
      return false;
    }

    // Default to smaller batch size (10) for better early termination behavior
    const batchSize = toPositiveInt(options.batchSize, Math.min(array.length, 10));
    const executionOptions: ThreadOptions = { ...options };

    for (let i = 0; i < array.length; i += batchSize) {
      const chunk = array.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map((item, offset) =>
          this.run<boolean>(
            predicate,
            this.createArgsPayload(item, i + offset, array),
            executionOptions
          )
        )
      );

      // If any result is true, return early
      if (results.some((result) => Boolean(result))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Tests whether all elements satisfy the predicate.
   * Similar to Array.prototype.every but processes in parallel batches.
   *
   * @template T - The type of array elements
   * @param array - The array to test
   * @param predicate - Function to test each element: (item, index, array) => boolean
   * @param options - Execution options including batchSize
   * @returns true if all elements pass the test
   *
   * @example
   * ```typescript
   * const allPositive = await threadts.every(
   *   [1, 2, 3, 4, 5],
   *   (x) => x > 0
   * );
   * console.log(allPositive); // true
   * ```
   */
  async every<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<boolean> {
    if (!array.length) {
      return true; // Empty arrays return true for every()
    }

    // Default to smaller batch size (10) for better early termination behavior
    const batchSize = toPositiveInt(options.batchSize, Math.min(array.length, 10));
    const executionOptions: ThreadOptions = { ...options };

    for (let i = 0; i < array.length; i += batchSize) {
      const chunk = array.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map((item, offset) =>
          this.run<boolean>(
            predicate,
            this.createArgsPayload(item, i + offset, array),
            executionOptions
          )
        )
      );

      // If any result is false, return early
      if (!results.every((result) => Boolean(result))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Executes multiple tasks as a batch with configurable batch size.
   * Tasks within a batch run in parallel, batches run sequentially.
   *
   * @param tasks - Array of tasks to execute
   * @param batchSize - Number of tasks to run in parallel (default: all)
   * @returns Array of task results with success/error information
   *
   * @example
   * ```typescript
   * const results = await threadts.batch([
   *   { fn: (x) => x * 2, data: 5 },
   *   { fn: (x) => x + 1, data: 10 }
   * ], 2);
   * ```
   */
  async batch(
    tasks: Array<ThreadTask | LegacyTask>,
    batchSize: number = tasks.length
  ): Promise<TaskResult[]> {
    if (!tasks.length) {
      return [];
    }

    const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
    const results: TaskResult[] = [];

    for (let index = 0; index < tasks.length; index += normalizedBatchSize) {
      const chunk = tasks.slice(index, index + normalizedBatchSize);

      const chunkResults = await Promise.all(
        chunk.map(async (task) => {
          try {
            const normalized = this.normalizeTask(task);
            const result = await this.run(
              normalized.fn,
              normalized.data as
                | SerializableData
                | InternalArgsPayload
                | undefined,
              normalized.options ?? {}
            );

            return {
              success: true,
              result: result as SerializableData,
              error: null,
            } satisfies TaskResult;
          } catch (error) {
            return {
              success: false,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            } satisfies TaskResult;
          }
        })
      );

      results.push(...chunkResults);
    }

    return results;
  }

  async parallel<T = unknown>(
    tasks: Array<ThreadTask | LegacyTask>
  ): Promise<T[]> {
    const results = await this.batch(tasks);
    const failures = results.filter((result) => !result.success);

    if (failures.length > 0) {
      const message = failures
        .map((failure) => failure.error)
        .filter((error): error is string => Boolean(error))
        .join('; ');

      throw new WorkerError(
        message || 'Parallel execution failed for one or more tasks'
      );
    }

    return results.map((result) => result.result as T);
  }

  async resize(newSize: number): Promise<void> {
    const oldSize = this.config.poolSize;
    this.config.poolSize = newSize;
    this.emitEvent('pool-resize', { oldSize, newSize });
  }

  getPoolSize(): number {
    return this.config.poolSize;
  }

  getActiveWorkers(): number {
    return 0;
  }

  getQueueLength(): number {
    return 0; // Simplified
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  getConfig(): ThreadConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ThreadConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getStats(): {
    activeWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
    completedTasks: number;
    averageExecutionTime: number;
  } {
    return {
      activeWorkers: this.getActiveWorkers(),
      idleWorkers: Math.max(0, this.config.poolSize - this.getActiveWorkers()),
      queuedTasks: this.getQueueLength(),
      completedTasks: this.completedTasks,
      averageExecutionTime:
        this.completedTasks > 0
          ? this.totalExecutionTime / this.completedTasks
          : 0,
    };
  }

  getPlatform(): string {
    return PlatformUtils.detectPlatform();
  }

  isSupported(): boolean {
    return PlatformUtils.supportsWorkerThreads();
  }

  private generateTaskId(): string {
    return `task-${++this.taskCounter}-${Date.now()}`;
  }

  async terminate(): Promise<void> {
    this.isReady = false;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.totalExecutionTime = 0;
    this.taskCounter = 0;
    this.eventListeners.clear();

    if (ThreadTS._instance === this) {
      ThreadTS._instance = null;
    }
  }

  static async terminateAll(): Promise<void> {
    if (ThreadTS._instance) {
      await ThreadTS._instance.terminate();
    }
  }

  // Static methods for backward compatibility
  static async run<T = unknown>(
    func: SerializableFunction,
    data?: SerializableData,
    options: ThreadOptions = {}
  ): Promise<T> {
    const instance = ThreadTS.getInstance();
    return instance.run<T>(func, data, options);
  }

  static async map<T, R = T>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<R[]> {
    const instance = ThreadTS.getInstance();
    return instance.map<T, R>(array, func, options);
  }

  static async filter<T>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.filter(array, func, options);
  }

  static async reduce<T, R>(
    array: T[],
    func: SerializableFunction,
    initialValue: R,
    options: ThreadOptions = {}
  ): Promise<R> {
    const instance = ThreadTS.getInstance();
    return instance.reduce(array, func, initialValue, options);
  }

  static async forEach<T>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<void> {
    const instance = ThreadTS.getInstance();
    return instance.forEach(array, func, options);
  }

  /**
   * Static method to find the first element satisfying the predicate.
   * @see {@link ThreadTS.find} for instance method documentation
   */
  static async find<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<T | undefined> {
    const instance = ThreadTS.getInstance();
    return instance.find(array, predicate, options);
  }

  /**
   * Static method to find the index of the first element satisfying the predicate.
   * @see {@link ThreadTS.findIndex} for instance method documentation
   */
  static async findIndex<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<number> {
    const instance = ThreadTS.getInstance();
    return instance.findIndex(array, predicate, options);
  }

  /**
   * Static method to test if any element satisfies the predicate.
   * @see {@link ThreadTS.some} for instance method documentation
   */
  static async some<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<boolean> {
    const instance = ThreadTS.getInstance();
    return instance.some(array, predicate, options);
  }

  /**
   * Static method to test if all elements satisfy the predicate.
   * @see {@link ThreadTS.every} for instance method documentation
   */
  static async every<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<boolean> {
    const instance = ThreadTS.getInstance();
    return instance.every(array, predicate, options);
  }

  static async batch(
    tasks: Array<ThreadTask | LegacyTask>,
    batchSize?: number
  ): Promise<TaskResult[]> {
    const instance = ThreadTS.getInstance();
    return instance.batch(tasks, batchSize);
  }

  static async parallel<T = unknown>(
    tasks: Array<ThreadTask | LegacyTask>
  ): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.parallel(tasks);
  }

  static async resize(newSize: number): Promise<void> {
    const instance = ThreadTS.getInstance();
    return instance.resize(newSize);
  }

  static getPoolSize(): number {
    const instance = ThreadTS.getInstance();
    return instance.getPoolSize();
  }

  static getActiveWorkers(): number {
    const instance = ThreadTS.getInstance();
    return instance.getActiveWorkers();
  }

  static getQueueLength(): number {
    const instance = ThreadTS.getInstance();
    return instance.getQueueLength();
  }

  static isInitialized(): boolean {
    const instance = ThreadTS.getInstance();
    return instance.isInitialized();
  }

  static getConfig(): ThreadConfig {
    const instance = ThreadTS.getInstance();
    return instance.getConfig();
  }

  static updateConfig(newConfig: Partial<ThreadConfig>): void {
    const instance = ThreadTS.getInstance();
    return instance.updateConfig(newConfig);
  }

  static getStats(): {
    activeWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
    completedTasks: number;
    averageExecutionTime: number;
  } {
    const instance = ThreadTS.getInstance();
    return instance.getStats();
  }

  static getPlatform(): string {
    return PlatformUtils.detectPlatform();
  }

  static isSupported(): boolean {
    return PlatformUtils.supportsWorkerThreads();
  }
}

export default ThreadTS;

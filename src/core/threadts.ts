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
import { ThreadError, TimeoutError, WorkerError } from '../types';
import { PlatformUtils } from '../utils/platform';
import {
  toPositiveInt,
  validateFunction,
  validateSerializable,
} from '../utils/validation';

/**
 * Default batch size for search operations (find, findIndex, some, every).
 * A smaller batch size provides better early termination behavior.
 */
const DEFAULT_SEARCH_BATCH_SIZE = 10;

/**
 * Calculates the default batch size for search operations.
 * Uses a smaller batch size for better early termination behavior.
 *
 * @param arrayLength - The length of the array being processed
 * @returns The calculated batch size
 */
function getDefaultSearchBatchSize(arrayLength: number): number {
  return Math.min(arrayLength, DEFAULT_SEARCH_BATCH_SIZE);
}

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
    const batchSize = toPositiveInt(
      options.batchSize,
      getDefaultSearchBatchSize(array.length)
    );
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

    const batchSize = toPositiveInt(
      options.batchSize,
      getDefaultSearchBatchSize(array.length)
    );
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

    const batchSize = toPositiveInt(
      options.batchSize,
      getDefaultSearchBatchSize(array.length)
    );
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

    const batchSize = toPositiveInt(
      options.batchSize,
      getDefaultSearchBatchSize(array.length)
    );
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
   * Maps each element to an array and flattens the result.
   * Similar to Array.prototype.flatMap but processes in parallel.
   *
   * @template T - The type of array elements
   * @template R - The type of result array elements
   * @param array - The array to process
   * @param func - Function that returns an array for each element: (item, index, array) => R[]
   * @param options - Execution options including batchSize
   * @returns Flattened array of results
   *
   * @example
   * ```typescript
   * const result = await threadts.flatMap(
   *   [1, 2, 3],
   *   (x) => [x, x * 2]
   * );
   * console.log(result); // [1, 2, 2, 4, 3, 6]
   * ```
   */
  async flatMap<T, R>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<R[]> {
    if (!array.length) {
      return [];
    }

    const results = await this.map<T, R[]>(array, func, options);
    return results.flat() as R[];
  }

  /**
   * Reduces an array from right to left.
   * Similar to Array.prototype.reduceRight but processes in parallel where possible.
   *
   * @template T - The type of array elements
   * @template R - The type of the accumulator
   * @param array - The array to reduce
   * @param reducer - Function to execute on each element: (acc, item, index, array) => R
   * @param initialValue - Initial value for the accumulator
   * @param options - Execution options
   * @returns The final accumulated value
   *
   * @example
   * ```typescript
   * const result = await threadts.reduceRight(
   *   ['a', 'b', 'c'],
   *   (acc, item) => acc + item,
   *   ''
   * );
   * console.log(result); // 'cba'
   * ```
   */
  async reduceRight<T, R>(
    array: T[],
    reducer: SerializableFunction,
    initialValue: R,
    options: ThreadOptions = {}
  ): Promise<R> {
    let accumulator = initialValue;

    if (!array.length) {
      return accumulator;
    }

    // Process from right to left
    for (let index = array.length - 1; index >= 0; index--) {
      accumulator = await this.run<R>(
        reducer,
        this.createArgsPayload(accumulator, array[index], index, array),
        options
      );
    }

    return accumulator;
  }

  /**
   * Groups array elements by a key returned from the function.
   * Processes the grouping function in parallel for performance.
   *
   * @template T - The type of array elements
   * @template K - The type of the grouping key
   * @param array - The array to group
   * @param keyFn - Function that returns the group key: (item, index, array) => K
   * @param options - Execution options including batchSize
   * @returns Map of grouped elements
   *
   * @example
   * ```typescript
   * const grouped = await threadts.groupBy(
   *   [{ type: 'a', value: 1 }, { type: 'b', value: 2 }, { type: 'a', value: 3 }],
   *   (item) => item.type
   * );
   * // Map { 'a' => [{type: 'a', value: 1}, {type: 'a', value: 3}], 'b' => [{type: 'b', value: 2}] }
   * ```
   */
  async groupBy<T, K extends string | number | symbol>(
    array: T[],
    keyFn: SerializableFunction,
    options: MapOptions = {}
  ): Promise<Map<K, T[]>> {
    if (!array.length) {
      return new Map();
    }

    const keys = await this.map<T, K>(array, keyFn, options);
    const result = new Map<K, T[]>();

    for (let i = 0; i < array.length; i++) {
      const key = keys[i];
      if (!result.has(key)) {
        result.set(key, []);
      }
      result.get(key)!.push(array[i]);
    }

    return result;
  }

  /**
   * Partitions an array into two arrays based on a predicate.
   * Elements that satisfy the predicate go to the first array,
   * elements that don't go to the second array.
   *
   * @template T - The type of array elements
   * @param array - The array to partition
   * @param predicate - Function to test each element: (item, index, array) => boolean
   * @param options - Execution options including batchSize
   * @returns Tuple of [matching elements, non-matching elements]
   *
   * @example
   * ```typescript
   * const [evens, odds] = await threadts.partition(
   *   [1, 2, 3, 4, 5],
   *   (x) => x % 2 === 0
   * );
   * console.log(evens); // [2, 4]
   * console.log(odds);  // [1, 3, 5]
   * ```
   */
  async partition<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<[T[], T[]]> {
    if (!array.length) {
      return [[], []];
    }

    const results = await this.map<T, boolean>(array, predicate, options);
    const truthy: T[] = [];
    const falsy: T[] = [];

    for (let i = 0; i < array.length; i++) {
      if (results[i]) {
        truthy.push(array[i]);
      } else {
        falsy.push(array[i]);
      }
    }

    return [truthy, falsy];
  }

  /**
   * Counts elements that satisfy a predicate.
   * Like filter().length but more efficient as it doesn't store filtered elements.
   *
   * @template T - The type of array elements
   * @param array - The array to count
   * @param predicate - Function to test each element: (item, index, array) => boolean
   * @param options - Execution options including batchSize
   * @returns The count of matching elements
   *
   * @example
   * ```typescript
   * const count = await threadts.count(
   *   [1, 2, 3, 4, 5],
   *   (x) => x > 2
   * );
   * console.log(count); // 3
   * ```
   */
  async count<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<number> {
    if (!array.length) {
      return 0;
    }

    const results = await this.map<T, boolean>(array, predicate, options);
    return results.filter(Boolean).length;
  }

  /**
   * Creates a pipeline for chaining parallel operations.
   * Returns a fluent interface for building complex data transformations.
   *
   * @template T - The type of initial array elements
   * @param array - The initial array to process
   * @returns A Pipeline instance for chaining operations
   *
   * @example
   * ```typescript
   * const result = await threadts.pipe([1, 2, 3, 4, 5])
   *   .map((x) => x * 2)
   *   .filter((x) => x > 4)
   *   .reduce((acc, x) => acc + x, 0)
   *   .execute();
   * console.log(result); // 24 (6 + 8 + 10)
   * ```
   */
  pipe<T>(array: T[]): Pipeline<T> {
    return new Pipeline<T>(array, this);
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

  /**
   * Static method to create a flatMap operation.
   * @see {@link ThreadTS.flatMap} for instance method documentation
   */
  static async flatMap<T, R>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<R[]> {
    const instance = ThreadTS.getInstance();
    return instance.flatMap<T, R>(array, func, options);
  }

  /**
   * Static method to reduce an array from right to left.
   * @see {@link ThreadTS.reduceRight} for instance method documentation
   */
  static async reduceRight<T, R>(
    array: T[],
    reducer: SerializableFunction,
    initialValue: R,
    options: ThreadOptions = {}
  ): Promise<R> {
    const instance = ThreadTS.getInstance();
    return instance.reduceRight<T, R>(array, reducer, initialValue, options);
  }

  /**
   * Static method to group array elements by a key.
   * @see {@link ThreadTS.groupBy} for instance method documentation
   */
  static async groupBy<T, K extends string | number | symbol>(
    array: T[],
    keyFn: SerializableFunction,
    options: MapOptions = {}
  ): Promise<Map<K, T[]>> {
    const instance = ThreadTS.getInstance();
    return instance.groupBy<T, K>(array, keyFn, options);
  }

  /**
   * Static method to partition an array into two arrays.
   * @see {@link ThreadTS.partition} for instance method documentation
   */
  static async partition<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<[T[], T[]]> {
    const instance = ThreadTS.getInstance();
    return instance.partition<T>(array, predicate, options);
  }

  /**
   * Static method to count elements matching a predicate.
   * @see {@link ThreadTS.count} for instance method documentation
   */
  static async count<T>(
    array: T[],
    predicate: SerializableFunction,
    options: MapOptions = {}
  ): Promise<number> {
    const instance = ThreadTS.getInstance();
    return instance.count<T>(array, predicate, options);
  }

  /**
   * Static method to create a pipeline for chaining operations.
   * @see {@link ThreadTS.pipe} for instance method documentation
   */
  static pipe<T>(array: T[]): Pipeline<T> {
    const instance = ThreadTS.getInstance();
    return instance.pipe<T>(array);
  }
}

/**
 * Pipeline operation definition for lazy evaluation.
 */
interface PipelineOperation {
  type: string;
  fn?: SerializableFunction;
  options?: MapOptions | ThreadOptions;
  initialValue?: unknown;
  count?: number;
}

/**
 * Pipeline class for fluent chaining of parallel operations.
 * Supports lazy evaluation - operations are only executed when execute() is called.
 *
 * @template T - The current type of array elements
 *
 * @example
 * ```typescript
 * const result = await ThreadTS.pipe([1, 2, 3, 4, 5])
 *   .map(x => x * 2)
 *   .filter(x => x > 4)
 *   .reduce((acc, x) => acc + x, 0)
 *   .execute();
 * ```
 */
class Pipeline<T> {
  private operations: PipelineOperation[] = [];

  constructor(
    private array: T[],
    private threadts: ThreadTS
  ) {}

  /**
   * Adds a map operation to the pipeline.
   */
  map<R>(fn: SerializableFunction, options?: MapOptions): Pipeline<R> {
    this.operations.push({ type: 'map', fn, options });
    return this as unknown as Pipeline<R>;
  }

  /**
   * Adds a filter operation to the pipeline.
   */
  filter(fn: SerializableFunction, options?: MapOptions): Pipeline<T> {
    this.operations.push({ type: 'filter', fn, options });
    return this;
  }

  /**
   * Adds a flatMap operation to the pipeline.
   */
  flatMap<R>(fn: SerializableFunction, options?: MapOptions): Pipeline<R> {
    this.operations.push({ type: 'flatMap', fn, options });
    return this as unknown as Pipeline<R>;
  }

  /**
   * Takes the first n elements from the pipeline.
   * This is a synchronous operation that limits results.
   *
   * @param count - Number of elements to take
   * @returns Pipeline with limited elements
   *
   * @example
   * ```typescript
   * const first3 = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .take(3)
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  take(count: number): Pipeline<T> {
    this.operations.push({
      type: 'take',
      count: Math.max(0, Math.floor(count)),
    });
    return this;
  }

  /**
   * Skips the first n elements from the pipeline.
   * This is a synchronous operation that offsets results.
   *
   * @param count - Number of elements to skip
   * @returns Pipeline with offset elements
   *
   * @example
   * ```typescript
   * const afterFirst2 = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .skip(2)
   *   .execute();
   * // Result: [3, 4, 5]
   * ```
   */
  skip(count: number): Pipeline<T> {
    this.operations.push({
      type: 'skip',
      count: Math.max(0, Math.floor(count)),
    });
    return this;
  }

  /**
   * Splits the array into chunks of the specified size.
   * Returns a pipeline of arrays.
   *
   * @param size - Size of each chunk
   * @returns Pipeline with chunked arrays
   *
   * @example
   * ```typescript
   * const chunks = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .chunk(2)
   *   .execute();
   * // Result: [[1, 2], [3, 4], [5]]
   * ```
   */
  chunk(size: number): Pipeline<T[]> {
    this.operations.push({
      type: 'chunk',
      count: Math.max(1, Math.floor(size)),
    });
    return this as unknown as Pipeline<T[]>;
  }

  /**
   * Removes duplicate elements from the pipeline.
   * Uses JSON.stringify for comparison by default.
   *
   * @param keyFn - Optional function to extract comparison key
   * @returns Pipeline with unique elements
   *
   * @example
   * ```typescript
   * const unique = await ThreadTS.pipe([1, 2, 2, 3, 3, 3])
   *   .unique()
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  unique(keyFn?: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'unique', fn: keyFn });
    return this;
  }

  /**
   * Reverses the order of elements in the pipeline.
   *
   * @returns Pipeline with reversed elements
   *
   * @example
   * ```typescript
   * const reversed = await ThreadTS.pipe([1, 2, 3])
   *   .reverse()
   *   .execute();
   * // Result: [3, 2, 1]
   * ```
   */
  reverse(): Pipeline<T> {
    this.operations.push({ type: 'reverse' });
    return this;
  }

  /**
   * Sorts elements in the pipeline.
   *
   * @param compareFn - Optional comparison function
   * @returns Pipeline with sorted elements
   *
   * @example
   * ```typescript
   * const sorted = await ThreadTS.pipe([3, 1, 2])
   *   .sort((a, b) => a - b)
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  sort(compareFn?: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'sort', fn: compareFn });
    return this;
  }

  /**
   * Adds a reduce operation to the pipeline. This is a terminal operation.
   */
  reduce<R>(
    fn: SerializableFunction,
    initialValue: R,
    options?: ThreadOptions
  ): TerminalPipeline<R> {
    this.operations.push({ type: 'reduce', fn, initialValue, options });
    return new TerminalPipeline<R>(this.array, this.operations, this.threadts);
  }

  /**
   * Adds a forEach operation to the pipeline. This is a terminal operation.
   */
  forEach(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<void> {
    this.operations.push({ type: 'forEach', fn, options });
    return new TerminalPipeline<void>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a find operation to the pipeline. This is a terminal operation.
   */
  find(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'find', fn, options });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a findIndex operation to the pipeline. This is a terminal operation.
   */
  findIndex(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<number> {
    this.operations.push({ type: 'findIndex', fn, options });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a some operation to the pipeline. This is a terminal operation.
   */
  some(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<boolean> {
    this.operations.push({ type: 'some', fn, options });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds an every operation to the pipeline. This is a terminal operation.
   */
  every(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<boolean> {
    this.operations.push({ type: 'every', fn, options });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a count operation to the pipeline. This is a terminal operation.
   * If no predicate is provided, counts all elements.
   */
  count(
    fn?: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<number> {
    const countFn = fn ?? (() => true);
    this.operations.push({ type: 'count', fn: countFn, options });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Groups elements by a key function. This is a terminal operation.
   *
   * @param keyFn - Function that returns the group key for each element
   * @param options - Execution options
   * @returns TerminalPipeline that resolves to a Map of grouped elements
   *
   * @example
   * ```typescript
   * const grouped = await ThreadTS.pipe(users)
   *   .groupBy(user => user.role)
   *   .execute();
   * ```
   */
  groupBy<K extends string | number | symbol>(
    keyFn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<Map<K, T[]>> {
    this.operations.push({ type: 'groupBy', fn: keyFn, options });
    return new TerminalPipeline<Map<K, T[]>>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Partitions elements into two arrays based on a predicate. This is a terminal operation.
   *
   * @param predicate - Function that returns true for elements in the first partition
   * @param options - Execution options
   * @returns TerminalPipeline that resolves to a tuple of [matching, non-matching]
   *
   * @example
   * ```typescript
   * const [evens, odds] = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .partition(x => x % 2 === 0)
   *   .execute();
   * ```
   */
  partition(
    predicate: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<[T[], T[]]> {
    this.operations.push({ type: 'partition', fn: predicate, options });
    return new TerminalPipeline<[T[], T[]]>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Gets the first element of the pipeline. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the first element or undefined
   */
  first(): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'first' });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Gets the last element of the pipeline. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the last element or undefined
   */
  last(): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'last' });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Checks if the pipeline contains no elements. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to true if empty
   */
  isEmpty(): TerminalPipeline<boolean> {
    this.operations.push({ type: 'isEmpty' });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Calculates the sum of numeric elements. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the sum
   */
  sum(): TerminalPipeline<number> {
    this.operations.push({ type: 'sum' });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Calculates the average of numeric elements. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the average or NaN if empty
   */
  average(): TerminalPipeline<number> {
    this.operations.push({ type: 'average' });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Finds the minimum element. This is a terminal operation.
   *
   * @param compareFn - Optional comparison function
   * @returns TerminalPipeline that resolves to the minimum element
   */
  min(compareFn?: SerializableFunction): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'min', fn: compareFn });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Finds the maximum element. This is a terminal operation.
   *
   * @param compareFn - Optional comparison function
   * @returns TerminalPipeline that resolves to the maximum element
   */
  max(compareFn?: SerializableFunction): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'max', fn: compareFn });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Executes all operations in the pipeline and returns the result array.
   */
  async execute(): Promise<T[]> {
    let result: unknown[] = this.array;

    for (const op of this.operations) {
      switch (op.type) {
        case 'map':
          result = await this.threadts.map(
            result,
            op.fn!,
            op.options as MapOptions
          );
          break;
        case 'filter':
          result = await this.threadts.filter(
            result,
            op.fn!,
            op.options as MapOptions
          );
          break;
        case 'flatMap':
          result = await this.threadts.flatMap(
            result,
            op.fn!,
            op.options as MapOptions
          );
          break;
        case 'take':
          result = result.slice(0, op.count ?? 0);
          break;
        case 'skip':
          result = result.slice(op.count ?? 0);
          break;
        case 'chunk': {
          const chunkSize = op.count ?? 1;
          const chunks: unknown[][] = [];
          for (let i = 0; i < result.length; i += chunkSize) {
            chunks.push(result.slice(i, i + chunkSize));
          }
          result = chunks;
          break;
        }
        case 'unique': {
          const seen = new Set<string>();
          const uniqueResult: unknown[] = [];
          for (const item of result) {
            const key = op.fn
              ? JSON.stringify(op.fn(item))
              : JSON.stringify(item);
            if (!seen.has(key)) {
              seen.add(key);
              uniqueResult.push(item);
            }
          }
          result = uniqueResult;
          break;
        }
        case 'reverse':
          result = [...result].reverse();
          break;
        case 'sort':
          result = [...result].sort(
            op.fn as ((a: unknown, b: unknown) => number) | undefined
          );
          break;
      }
    }

    return result as T[];
  }

  /**
   * Collects the pipeline results into an array.
   * Alias for execute().
   */
  async toArray(): Promise<T[]> {
    return this.execute();
  }

  /**
   * Collects the pipeline results into a Set.
   */
  async toSet(): Promise<Set<T>> {
    const result = await this.execute();
    return new Set(result);
  }

  /**
   * Collects the pipeline results into a Map using a key function.
   *
   * @param keyFn - Function that returns the key for each element
   * @returns Promise that resolves to a Map
   */
  async toMap<K>(keyFn: (item: T) => K): Promise<Map<K, T>> {
    const result = await this.execute();
    const map = new Map<K, T>();
    for (const item of result) {
      map.set(keyFn(item), item);
    }
    return map;
  }
}

/**
 * Terminal pipeline for operations that produce a single value.
 */
class TerminalPipeline<R> {
  constructor(
    private array: unknown[],
    private operations: PipelineOperation[],
    private threadts: ThreadTS
  ) {}

  /**
   * Executes all operations in the pipeline and returns the final result.
   */
  async execute(): Promise<R> {
    let result: unknown[] = this.array;

    for (let i = 0; i < this.operations.length; i++) {
      const op = this.operations[i];
      const isLast = i === this.operations.length - 1;

      switch (op.type) {
        case 'map':
          result = await this.threadts.map(
            result,
            op.fn!,
            op.options as MapOptions
          );
          break;
        case 'filter':
          result = await this.threadts.filter(
            result,
            op.fn!,
            op.options as MapOptions
          );
          break;
        case 'flatMap':
          result = await this.threadts.flatMap(
            result,
            op.fn!,
            op.options as MapOptions
          );
          break;
        case 'take':
          result = result.slice(0, op.count ?? 0);
          break;
        case 'skip':
          result = result.slice(op.count ?? 0);
          break;
        case 'chunk': {
          const chunkSize = op.count ?? 1;
          const chunks: unknown[][] = [];
          for (let j = 0; j < result.length; j += chunkSize) {
            chunks.push(result.slice(j, j + chunkSize));
          }
          result = chunks;
          break;
        }
        case 'unique': {
          const seen = new Set<string>();
          const uniqueResult: unknown[] = [];
          for (const item of result) {
            const key = op.fn
              ? JSON.stringify(op.fn(item))
              : JSON.stringify(item);
            if (!seen.has(key)) {
              seen.add(key);
              uniqueResult.push(item);
            }
          }
          result = uniqueResult;
          break;
        }
        case 'reverse':
          result = [...result].reverse();
          break;
        case 'sort':
          result = [...result].sort(
            op.fn as ((a: unknown, b: unknown) => number) | undefined
          );
          break;
        case 'reduce':
          if (isLast) {
            return this.threadts.reduce(
              result,
              op.fn!,
              op.initialValue as R,
              op.options as ThreadOptions
            );
          }
          break;
        case 'forEach':
          if (isLast) {
            await this.threadts.forEach(
              result,
              op.fn!,
              op.options as MapOptions
            );
            return undefined as R;
          }
          break;
        case 'find':
          if (isLast) {
            return this.threadts.find(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'findIndex':
          if (isLast) {
            return this.threadts.findIndex(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'some':
          if (isLast) {
            return this.threadts.some(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'every':
          if (isLast) {
            return this.threadts.every(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'count':
          if (isLast) {
            return this.threadts.count(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'groupBy':
          if (isLast) {
            return this.threadts.groupBy(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'partition':
          if (isLast) {
            return this.threadts.partition(
              result,
              op.fn!,
              op.options as MapOptions
            ) as Promise<R>;
          }
          break;
        case 'first':
          if (isLast) {
            return (result.length > 0 ? result[0] : undefined) as R;
          }
          break;
        case 'last':
          if (isLast) {
            return (
              result.length > 0 ? result[result.length - 1] : undefined
            ) as R;
          }
          break;
        case 'isEmpty':
          if (isLast) {
            return (result.length === 0) as R;
          }
          break;
        case 'sum':
          if (isLast) {
            return result.reduce(
              (acc: number, val) => acc + (typeof val === 'number' ? val : 0),
              0
            ) as R;
          }
          break;
        case 'average':
          if (isLast) {
            if (result.length === 0) return NaN as R;
            const sum = result.reduce(
              (acc: number, val) => acc + (typeof val === 'number' ? val : 0),
              0
            );
            return (sum / result.length) as R;
          }
          break;
        case 'min':
          if (isLast) {
            if (result.length === 0) return undefined as R;
            const compareFn = op.fn as
              | ((a: unknown, b: unknown) => number)
              | undefined;
            return [...result].sort(
              compareFn ??
                ((a, b) => {
                  if (a === b) return 0;
                  return (a as number) < (b as number) ? -1 : 1;
                })
            )[0] as R;
          }
          break;
        case 'max':
          if (isLast) {
            if (result.length === 0) return undefined as R;
            const compareFn = op.fn as
              | ((a: unknown, b: unknown) => number)
              | undefined;
            return [...result].sort(
              compareFn ??
                ((a, b) => {
                  if (a === b) return 0;
                  return (a as number) > (b as number) ? -1 : 1;
                })
            )[0] as R;
          }
          break;
      }
    }

    return result as R;
  }
}

export { Pipeline, TerminalPipeline };

export default ThreadTS;

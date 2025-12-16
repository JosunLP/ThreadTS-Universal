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
import {
  createArrayOperations,
  type ArrayOperations,
} from './array-operations';
import { Pipeline, TerminalPipeline } from './pipeline';

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

  /** Extended array operations */
  private arrayOps: ArrayOperations | null = null;

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
      // Initialize array operations
      this.arrayOps = createArrayOperations(this);
      this.emitEvent('pool-resize', {
        oldSize: 0,
        newSize: this.config.poolSize,
      });
    } catch (error) {
      console.error('Failed to initialize ThreadTS:', error);
      throw error;
    }
  }

  /**
   * Returns the extended array operations module.
   * Provides additional array methods like indexOf, lastIndexOf, at, slice, etc.
   *
   * @returns The ArrayOperations object with extended methods
   *
   * @example
   * ```typescript
   * const ops = threadts.getArrayOps();
   * const index = await ops.indexOf([1, 2, 3], 2);
   * const chunk = await ops.chunk([1, 2, 3, 4, 5], 2);
   * ```
   */
  getArrayOps(): ArrayOperations {
    if (!this.arrayOps) {
      this.arrayOps = createArrayOperations(this);
    }
    return this.arrayOps;
  }

  // ==================== Extended Array Methods ====================

  /**
   * Finds the index of the first occurrence of a value in the array.
   * @see ArrayOperations.indexOf
   */
  async indexOf<T>(
    array: T[],
    searchElement: T,
    fromIndex = 0
  ): Promise<number> {
    return this.getArrayOps().indexOf(array, searchElement, fromIndex);
  }

  /**
   * Finds the index of the last occurrence of a value in the array.
   * @see ArrayOperations.lastIndexOf
   */
  async lastIndexOf<T>(
    array: T[],
    searchElement: T,
    fromIndex?: number
  ): Promise<number> {
    return this.getArrayOps().lastIndexOf(array, searchElement, fromIndex);
  }

  /**
   * Returns the element at the specified index.
   * @see ArrayOperations.at
   */
  async at<T>(array: T[], index: number): Promise<T | undefined> {
    return this.getArrayOps().at(array, index);
  }

  /**
   * Creates a new array with elements from startIndex to endIndex.
   * @see ArrayOperations.slice
   */
  async slice<T>(array: T[], start?: number, end?: number): Promise<T[]> {
    return this.getArrayOps().slice(array, start, end);
  }

  /**
   * Concatenates multiple arrays into one.
   * @see ArrayOperations.concat
   */
  async concat<T>(array: T[], ...items: (T | T[])[]): Promise<T[]> {
    return this.getArrayOps().concat(array, ...items);
  }

  /**
   * Creates an array containing a range of numbers.
   * @see ArrayOperations.range
   */
  async range(start: number, end: number, step = 1): Promise<number[]> {
    return this.getArrayOps().range(start, end, step);
  }

  /**
   * Creates an array by repeating a value.
   * @see ArrayOperations.repeat
   */
  async repeat<T>(value: T, count: number): Promise<T[]> {
    return this.getArrayOps().repeat(value, count);
  }

  /**
   * Removes duplicate values from an array.
   * @see ArrayOperations.unique
   */
  async unique<T>(array: T[]): Promise<T[]> {
    return this.getArrayOps().unique(array);
  }

  /**
   * Removes duplicate values using a key function.
   * @see ArrayOperations.uniqueBy
   */
  async uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): Promise<T[]> {
    return this.getArrayOps().uniqueBy(array, keyFn);
  }

  /**
   * Splits an array into chunks of the specified size.
   * @see ArrayOperations.chunk
   */
  async chunk<T>(array: T[], size: number): Promise<T[][]> {
    return this.getArrayOps().chunk(array, size);
  }

  /**
   * Zips multiple arrays together into an array of tuples.
   * @see ArrayOperations.zip
   */
  async zip<T extends unknown[][]>(
    ...arrays: T
  ): Promise<{ [K in keyof T]: T[K] extends (infer U)[] ? U : never }[]> {
    return this.getArrayOps().zip(...arrays);
  }

  // ==================== ES2023+ Array Methods ====================

  /**
   * Finds the last element that satisfies the predicate.
   * @see ArrayOperations.findLast
   */
  async findLast<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => boolean
  ): Promise<T | undefined> {
    return this.getArrayOps().findLast(array, predicate);
  }

  /**
   * Finds the index of the last element that satisfies the predicate.
   * @see ArrayOperations.findLastIndex
   */
  async findLastIndex<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => boolean
  ): Promise<number> {
    return this.getArrayOps().findLastIndex(array, predicate);
  }

  /**
   * Returns a new sorted array (immutable).
   * @see ArrayOperations.toSorted
   */
  async toSorted<T>(
    array: T[],
    compareFn?: (a: T, b: T) => number
  ): Promise<T[]> {
    return this.getArrayOps().toSorted(array, compareFn);
  }

  /**
   * Returns a new reversed array (immutable).
   * @see ArrayOperations.toReversed
   */
  async toReversed<T>(array: T[]): Promise<T[]> {
    return this.getArrayOps().toReversed(array);
  }

  /**
   * Returns a new array with the element at the given index replaced.
   * @see ArrayOperations.withElement
   */
  async withElement<T>(array: T[], index: number, value: T): Promise<T[]> {
    return this.getArrayOps().withElement(array, index, value);
  }

  /**
   * Returns a new array with elements removed/replaced/added at a given index.
   * @see ArrayOperations.toSpliced
   */
  async toSpliced<T>(
    array: T[],
    start: number,
    deleteCount?: number,
    ...items: T[]
  ): Promise<T[]> {
    return this.getArrayOps().toSpliced(array, start, deleteCount, ...items);
  }

  /**
   * Groups elements of an array based on a callback function.
   * @see ArrayOperations.groupByObject
   */
  async groupByObject<T, K extends PropertyKey>(
    array: T[],
    keyFn: (item: T, index: number) => K
  ): Promise<Partial<Record<K, T[]>>> {
    return this.getArrayOps().groupByObject(array, keyFn);
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

  // ==================== Static Extended Array Methods ====================

  /**
   * Static method to find the index of an element.
   * @see {@link ThreadTS.indexOf} for instance method documentation
   */
  static async indexOf<T>(
    array: T[],
    searchElement: T,
    fromIndex = 0
  ): Promise<number> {
    const instance = ThreadTS.getInstance();
    return instance.indexOf(array, searchElement, fromIndex);
  }

  /**
   * Static method to find the last index of an element.
   * @see {@link ThreadTS.lastIndexOf} for instance method documentation
   */
  static async lastIndexOf<T>(
    array: T[],
    searchElement: T,
    fromIndex?: number
  ): Promise<number> {
    const instance = ThreadTS.getInstance();
    return instance.lastIndexOf(array, searchElement, fromIndex);
  }

  /**
   * Static method to get an element at a specific index.
   * @see {@link ThreadTS.at} for instance method documentation
   */
  static async at<T>(array: T[], index: number): Promise<T | undefined> {
    const instance = ThreadTS.getInstance();
    return instance.at(array, index);
  }

  /**
   * Static method to slice an array.
   * @see {@link ThreadTS.slice} for instance method documentation
   */
  static async slice<T>(
    array: T[],
    start?: number,
    end?: number
  ): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.slice(array, start, end);
  }

  /**
   * Static method to concatenate arrays.
   * @see {@link ThreadTS.concat} for instance method documentation
   */
  static async concat<T>(array: T[], ...items: (T | T[])[]): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.concat(array, ...items);
  }

  /**
   * Static method to create a range of numbers.
   * @see {@link ThreadTS.range} for instance method documentation
   */
  static async range(start: number, end: number, step = 1): Promise<number[]> {
    const instance = ThreadTS.getInstance();
    return instance.range(start, end, step);
  }

  /**
   * Static method to repeat a value.
   * @see {@link ThreadTS.repeat} for instance method documentation
   */
  static async repeat<T>(value: T, count: number): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.repeat(value, count);
  }

  /**
   * Static method to get unique values.
   * @see {@link ThreadTS.unique} for instance method documentation
   */
  static async unique<T>(array: T[]): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.unique(array);
  }

  /**
   * Static method to get unique values by key.
   * @see {@link ThreadTS.uniqueBy} for instance method documentation
   */
  static async uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.uniqueBy(array, keyFn);
  }

  /**
   * Static method to chunk an array.
   * @see {@link ThreadTS.chunk} for instance method documentation
   */
  static async chunk<T>(array: T[], size: number): Promise<T[][]> {
    const instance = ThreadTS.getInstance();
    return instance.chunk(array, size);
  }

  /**
   * Static method to zip arrays.
   * @see {@link ThreadTS.zip} for instance method documentation
   */
  static async zip<T extends unknown[][]>(
    ...arrays: T
  ): Promise<{ [K in keyof T]: T[K] extends (infer U)[] ? U : never }[]> {
    const instance = ThreadTS.getInstance();
    return instance.zip(...arrays);
  }

  /**
   * Static method to get the array operations module.
   * @see {@link ThreadTS.getArrayOps} for instance method documentation
   */
  static getArrayOps(): ArrayOperations {
    const instance = ThreadTS.getInstance();
    return instance.getArrayOps();
  }
}

// Re-export Pipeline classes from pipeline module
export { Pipeline, TerminalPipeline };

export default ThreadTS;

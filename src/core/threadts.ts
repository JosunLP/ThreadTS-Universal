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
  SerializationError,
  ThreadError,
  TimeoutError,
  WorkerError,
} from '../types';
import { PlatformUtils } from '../utils/platform';

interface ThreadEventMap {
  'task-complete': {
    taskId: string;
    result: SerializableData;
    duration: number;
  };
  'task-error': { taskId: string; error: string; duration: number };
  'pool-resize': { oldSize: number; newSize: number };
  'worker-spawn': { workerId: string; poolSize: number };
  'worker-terminate': { workerId: string; poolSize: number };
}

type ThreadEventListener<K extends keyof ThreadEventMap> = (
  detail: ThreadEventMap[K]
) => void;

const INTERNAL_ARGS_KEY = '__THREADTS_ARGS__' as const;

type InternalArgsPayload = {
  [INTERNAL_ARGS_KEY]: unknown[];
};

type LegacyTask = {
  fn?: SerializableFunction;
  func?: SerializableFunction;
  data?: SerializableData;
  options?: ThreadOptions;
};

interface NormalizedTask {
  fn: SerializableFunction;
  data?: SerializableData;
  options?: ThreadOptions;
}

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

  private ensureSerializable(
    value: unknown,
    seen = new WeakSet<object>()
  ): void {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'function') {
        throw new SerializationError(
          'Functions cannot be transferred as task data'
        );
      }
      return;
    }

    if (seen.has(value)) {
      throw new SerializationError('Circular reference detected in task data');
    }

    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        this.ensureSerializable(item, seen);
      }
      return;
    }

    for (const item of Object.values(value)) {
      this.ensureSerializable(item, seen);
    }
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

    if (typeof func !== 'function') {
      throw new ThreadError('Task must be a function', 'INVALID_TASK');
    }

    const taskId = this.generateTaskId();
    const startTime = PlatformUtils.getHighResTimestamp();
    const args = this.prepareArguments(data);

    for (const arg of args) {
      this.ensureSerializable(arg);
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

  async forEach<T>(
    array: T[],
    func: SerializableFunction,
    options: MapOptions = {}
  ): Promise<void> {
    await this.map<T, void>(array, func, options);
  }

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

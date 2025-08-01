import type {
  SerializableData,
  SerializableFunction,
  TaskResult,
  ThreadConfig,
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

export class ThreadTS extends EventTarget {
  private static _instance: ThreadTS | null = null;
  private config!: ThreadConfig;
  private isReady: boolean = false;
  private taskCounter: number = 0;
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

  async run<T extends SerializableData>(
    func: SerializableFunction,
    data?: SerializableData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: Partial<ThreadConfig> = {}
  ): Promise<T> {
    if (!this.isReady) {
      await this.initialize();
    }

    const taskId = this.generateTaskId();
    const startTime = performance.now();

    try {
      // Simplified execution - for now just call the function directly
      // In a real implementation, this would use worker threads
      const result = (func as (...args: unknown[]) => unknown)(data);

      const duration = performance.now() - startTime;
      this.emitEvent('task-complete', {
        taskId,
        result: result as SerializableData,
        duration,
      });

      return result as T;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.emitEvent('task-error', { taskId, error: errorMessage, duration });
      throw error;
    }
  }

  async map<T extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    options: Partial<ThreadConfig> = {}
  ): Promise<T[]> {
    if (!array.length) return [];

    const tasks = array.map((item, index) =>
      this.run(func, { item, index }, options)
    );

    const results = await Promise.all(tasks);
    return results as T[];
  }

  async filter<T extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    options: Partial<ThreadConfig> = {}
  ): Promise<T[]> {
    if (!array.length) return [];

    const filterResults = await this.map(
      array.map((item, index) => ({ item, index })),
      func,
      options
    );

    return array.filter((_, index) => Boolean(filterResults[index]));
  }

  async reduce<T extends SerializableData, R extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    initialValue: R,
    options: Partial<ThreadConfig> = {}
  ): Promise<R> {
    let accumulator = initialValue;

    for (const item of array) {
      accumulator = (await this.run(func, { accumulator, item }, options)) as R;
    }

    return accumulator;
  }

  async forEach<T extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    options: Partial<ThreadConfig> = {}
  ): Promise<void> {
    await this.map(array, func, options);
  }

  async batch(
    tasks: Array<{
      func: SerializableFunction;
      data?: SerializableData;
      options?: Partial<ThreadConfig>;
    }>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _batchSize?: number
  ): Promise<TaskResult[]> {
    const batchTasks = tasks.map(async ({ func, data, options = {} }) => {
      try {
        const result = await this.run(func, data, options);
        return { success: true, result, error: null };
      } catch (error) {
        return {
          success: false,
          result: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return Promise.all(batchTasks);
  }

  async parallel<T extends SerializableData>(
    tasks: Array<{
      func: SerializableFunction;
      data?: SerializableData;
      options?: Partial<ThreadConfig>;
    }>
  ): Promise<T[]> {
    const results = await this.batch(tasks);
    return results.map((r) => r.result as T);
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
    return 1; // Simplified
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
      completedTasks: this.taskCounter,
      averageExecutionTime: 0,
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
  static async run<T extends SerializableData>(
    func: SerializableFunction,
    data?: SerializableData,
    options: Partial<ThreadConfig> = {}
  ): Promise<T> {
    const instance = ThreadTS.getInstance();
    return instance.run<T>(func, data, options);
  }

  static async map<T extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    options: Partial<ThreadConfig> = {}
  ): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.map(array, func, options);
  }

  static async filter<T extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    options: Partial<ThreadConfig> = {}
  ): Promise<T[]> {
    const instance = ThreadTS.getInstance();
    return instance.filter(array, func, options);
  }

  static async reduce<T extends SerializableData, R extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    initialValue: R,
    options: Partial<ThreadConfig> = {}
  ): Promise<R> {
    const instance = ThreadTS.getInstance();
    return instance.reduce(array, func, initialValue, options);
  }

  static async forEach<T extends SerializableData>(
    array: T[],
    func: SerializableFunction,
    options: Partial<ThreadConfig> = {}
  ): Promise<void> {
    const instance = ThreadTS.getInstance();
    return instance.forEach(array, func, options);
  }

  static async batch(
    tasks: Array<{
      func: SerializableFunction;
      data?: SerializableData;
      options?: Partial<ThreadConfig>;
    }>,
    batchSize?: number
  ): Promise<TaskResult[]> {
    const instance = ThreadTS.getInstance();
    return instance.batch(tasks, batchSize);
  }

  static async parallel<T extends SerializableData>(
    tasks: Array<{
      func: SerializableFunction;
      data?: SerializableData;
      options?: Partial<ThreadConfig>;
    }>
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

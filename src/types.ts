/**
 * ThreadTS Universal - Core Types
 * Universal TypeScript library for effortless parallel computing
 */

// Core execution options
export interface ThreadOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  signal?: AbortSignal;
  transferable?: Transferable[];
  maxRetries?: number;
  poolSize?: number;
  // Enhanced Node.js specific options
  resourceLimits?: {
    maxOldGenerationSizeMb?: number;
    maxYoungGenerationSizeMb?: number;
    codeRangeSizeMb?: number;
    stackSizeMb?: number;
  };
  // Enhanced Deno specific options
  denoPermissions?: {
    net?: boolean | string[];
    read?: boolean | string[];
    write?: boolean | string[];
    env?: boolean | string[];
    run?: boolean | string[];
    ffi?: boolean | string[];
    hrtime?: boolean;
    sys?: boolean | string[];
  };
  // Enhanced Bun specific options
  bunOptions?: {
    name?: string;
    credentials?: 'omit' | 'same-origin' | 'include';
    highPrecisionTiming?: boolean;
    forceGC?: boolean;
  };
  // Cross-platform worker options
  workerName?: string;
  isolateContext?: boolean;
  trackResources?: boolean;
}

// Generic task definition used by batch/parallel helpers
export interface ThreadTask<TData = SerializableData> {
  fn: SerializableFunction;
  data?: TData;
  options?: ThreadOptions;
}

// Map/reduce helpers can specify batching behaviour in addition to thread options
export interface MapOptions extends ThreadOptions {
  batchSize?: number;
}

// Progress monitoring
export interface ProgressEvent {
  progress: number; // 0-100
  message?: string;
  data?: unknown;
}

// Execution result with metadata
export interface ThreadResult<T = unknown> {
  result: T;
  executionTime: number;
  workerId?: string;
  error?: Error;
}

// Worker pool configuration
export interface PoolConfig {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
  queueSize?: number;
  strategy?: 'round-robin' | 'least-busy' | 'random';
}

// Platform detection
export type Platform = 'browser' | 'node' | 'deno' | 'bun' | 'unknown';

// Serialization types - Type-safe alternatives to any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SerializableFunction = (...args: any[]) => any;
export type SerializableData =
  | string
  | number
  | boolean
  | null
  | undefined
  | ArrayBuffer
  | { [key: string]: unknown }
  | unknown[];

// TypedArray union type for better type safety
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

// Worker adapter interface
export interface WorkerAdapter {
  readonly platform: Platform;
  createWorker(script: string): Promise<WorkerInstance>;
  terminateWorker(worker: WorkerInstance): Promise<void>;
  isSupported(): boolean;
}

// Worker instance interface
export interface WorkerInstance {
  id: string;
  execute<T = unknown>(
    fn: SerializableFunction,
    data: SerializableData,
    options?: ThreadOptions
  ): Promise<ThreadResult<T>>;
  terminate(): Promise<void>;
  isIdle(): boolean;
}

// Pool manager interface
export interface PoolManager {
  execute<T = unknown>(
    fn: SerializableFunction,
    data: SerializableData,
    options?: ThreadOptions
  ): Promise<ThreadResult<T>>;
  resize(size: number): Promise<void>;
  terminate(): Promise<void>;
  getStats(): PoolStats;
}

// Pool statistics
export interface PoolStats {
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  averageExecutionTime: number;
}

// Error types
export class ThreadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ThreadError';
  }
}

export class TimeoutError extends ThreadError {
  constructor(timeout: number) {
    super(`Operation timed out after ${timeout}ms`, 'TIMEOUT');
  }
}

export class WorkerError extends ThreadError {
  constructor(message: string, cause?: Error) {
    super(message, 'WORKER_ERROR', cause);
  }
}

export class SerializationError extends ThreadError {
  constructor(message: string, cause?: Error) {
    super(message, 'SERIALIZATION_ERROR', cause);
  }
}

// Decorator types
export interface ParallelMethodOptions extends ThreadOptions {
  poolSize?: number;
  cacheResults?: boolean;
}

// Event emitter interface for progress tracking
export interface ProgressTracker {
  on(event: 'progress', handler: (event: ProgressEvent) => void): void;
  off(event: 'progress', handler: (event: ProgressEvent) => void): void;
  emit(event: 'progress', data: ProgressEvent): void;
}

// Main thread configuration
export interface ThreadConfig {
  poolSize: number;
  timeout: number;
  retries: number;
  autoResize: boolean;
  debug: boolean;
  serializationStrategy: 'auto' | 'json' | 'custom';
  enableDecorators: boolean;
  enableMetrics: boolean;
  maxQueueSize: number;
  workerIdleTimeout: number;
  taskPriority: 'low' | 'normal' | 'high';
}

// Task execution result
export interface TaskResult {
  success: boolean;
  result: SerializableData | null;
  error: string | null;
}

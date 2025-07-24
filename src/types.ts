/**
 * ThreadJS Universal - Core Types
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
}

// Progress monitoring
export interface ProgressEvent {
  progress: number; // 0-100
  message?: string;
  data?: any;
}

// Execution result with metadata
export interface ThreadResult<T = any> {
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

// Serialization types
export type SerializableFunction = (...args: any[]) => any;
export type SerializableData = any;

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
  execute<T = any>(
    fn: SerializableFunction,
    data: SerializableData,
    options?: ThreadOptions
  ): Promise<ThreadResult<T>>;
  terminate(): Promise<void>;
  isIdle(): boolean;
}

// Pool manager interface
export interface PoolManager {
  execute<T = any>(
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

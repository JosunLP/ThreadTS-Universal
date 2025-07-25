/**
 * ThreadTS Universal - Main Entry Point
 * Universal TypeScript library for effortless parallel computing
 */

// Core exports
export { ThreadTS, default as threadjs } from './core/threadjs';

// Type exports
export type {
  ParallelMethodOptions,
  Platform,
  PoolConfig,
  PoolManager,
  PoolStats,
  ProgressEvent,
  ProgressTracker,
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerInstance,
} from './types';

// Error exports
export {
  SerializationError,
  ThreadError,
  TimeoutError,
  WorkerError,
} from './types';

// Decorator exports
export {
  highPriority,
  lowPriority,
  parallel,
  parallelBatch,
  parallelClass,
  parallelMap,
  parallelMethod,
  timeout,
} from './decorators';

// Utility exports
export {
  detectPlatform,
  getHighResTimestamp,
  getMemoryInfo,
  getOptimalWorkerCount,
  supportsOffscreenCanvas,
  supportsTransferableObjects,
  supportsWebLocks,
  supportsWorkerThreads,
} from './utils/platform';

export type { MemoryInfo } from './utils/platform';

export {
  createWorkerScript,
  deserializeData,
  deserializeFunction,
  hasTransferables,
  restoreTransferables,
  serializeData,
  serializeFunction,
} from './utils/serialization';

// Adapter exports (for advanced usage)
export { BrowserWorkerAdapter } from './adapters/browser';
export { BunWorkerAdapter } from './adapters/bun';
export { DenoWorkerAdapter } from './adapters/deno';
export { NodeWorkerAdapter } from './adapters/node';

// Pool manager export
export { WorkerPoolManager } from './pool/manager';

// Default export for simple usage
import threadjs from './core/threadjs';
export default threadjs;

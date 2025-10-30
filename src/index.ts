/**
 * ThreadTS Universal - Main Entry Point
 * Universal TypeScript library for effortless parallel computing
 */

// Core exports
export { ThreadTS, default as threadts } from './core/threadts';

// Type exports
export type {
  MapOptions,
  ParallelMethodOptions,
  Platform,
  PoolConfig,
  PoolManager,
  PoolStats,
  ProgressEvent,
  ProgressTracker,
  ThreadOptions,
  ThreadResult,
  ThreadTask,
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
  memoize,
  parallel,
  parallelBatch,
  parallelClass,
  parallelMap,
  parallelMethod,
  rateLimit,
  retry,
} from './decorators';

// Utility exports
export {
  detectPlatform,
  getHighResTimestamp,
  getMemoryInfo,
  getOptimalThreadCount,
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
export { ThreadPoolManager } from './pool/manager';

// Monitoring and diagnostics
export { ErrorHandler, errorHandler } from './monitoring/error-handler';
export type {
  ErrorContext,
  ErrorMetrics,
  RecoveryStrategy,
} from './monitoring/error-handler';
export { HealthMonitor, healthMonitor } from './monitoring/health';
export type { HealthCheck, HealthStatus } from './monitoring/health';
export {
  PerformanceMonitor,
  performanceMonitor,
} from './monitoring/performance';
export type {
  PerformanceAlert,
  PerformanceMetrics,
} from './monitoring/performance';

// Default export for simple usage
import threadts from './core/threadts';
export default threadts;

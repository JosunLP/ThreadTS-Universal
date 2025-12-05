/**
 * ThreadTS Universal - Main Entry Point
 * Universal TypeScript library for effortless parallel computing
 *
 * @packageDocumentation
 * @module threadts-universal
 *
 * @example
 * ```typescript
 * import threadts from 'threadts-universal';
 *
 * // Simple parallel execution
 * const result = await threadts.run((x) => x * 2, 21);
 *
 * // Array operations
 * const squares = await threadts.map([1, 2, 3], x => x * x);
 * const found = await threadts.find([1, 2, 3, 4], x => x > 2);
 *
 * // Using options (e.g., batchSize) with find
 * const foundWithOptions = await threadts.find(
 *   [1, 2, 3, 4],
 *   x => x > 2,
 *   { batchSize: 2 }
 * );
 * ```
 */

// Core exports
export {
  Pipeline,
  TerminalPipeline,
  ThreadTS,
  default as threadts,
} from './core/threadts';

// Array operations exports
export {
  createArrayOperations,
  type ArrayOperationExecutor,
  type ArrayOperations,
} from './core/array-operations';

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
  cache,
  circuitBreaker,
  concurrent,
  createClassDecorator,
  createMethodDecorator,
  createMethodDecoratorWithClass,
  debounce,
  lazy,
  logged,
  measure,
  memoize,
  parallel,
  parallelBatch,
  parallelClass,
  parallelMap,
  parallelMethod,
  rateLimit,
  retry,
  throttle,
  timeout,
  validate,
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

// Validation utilities
export {
  ValidationUtils,
  toNonNegativeInt,
  toPositiveInt,
  validateArray,
  validateEnum,
  validateFunction,
  validateNonEmptyArray,
  validateNonNegativeNumber,
  validatePositiveNumber,
  validateRange,
  validateSerializable,
  validateTask,
  validateTasks,
  validateThreadOptions,
} from './utils/validation';

export type { ValidationResult } from './utils/validation';

// Adapter exports (for advanced usage)
export { BrowserWorkerAdapter } from './adapters/browser';
export { BunWorkerAdapter } from './adapters/bun';
export { DenoWorkerAdapter } from './adapters/deno';
export { NodeWorkerAdapter } from './adapters/node';

// Base adapter export (for extending)
export {
  AbstractWorkerAdapter,
  AbstractWorkerInstance,
  createWorkerErrorMessage,
  isWorkerInstance,
} from './adapters/base';

export type { BaseWorkerConfig, WorkerExecutionMetrics } from './adapters/base';

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

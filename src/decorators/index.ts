/**
 * ThreadTS Universal - Decorators
 *
 * Re-exports all decorator modules for convenient access.
 * Decorators are organized into categories:
 *
 * - **Parallel**: @parallelMethod, @parallelClass, @parallel, @parallelBatch, @parallelMap
 * - **Caching**: @memoize, @cache, @lazy
 * - **Flow Control**: @retry, @rateLimit, @timeout, @debounce, @throttle, @concurrent, @circuitBreaker
 * - **Observability**: @logged, @measure, @validate
 * - **Utilities**: createMethodDecorator, createMethodDecoratorWithClass, createClassDecorator
 *
 * @module decorators
 */

// Decorator utilities for creating custom decorators
export {
  createClassDecorator,
  createMethodDecorator,
  createMethodDecoratorWithClass,
  ensureAsync,
  isAsyncFunction,
} from './utils';

// Export utility types
export type {
  AnyFunction,
  DecoratorContext,
  DecoratorReturnType,
} from './utils';

// Parallel decorators
export {
  parallel,
  parallelBatch,
  parallelClass,
  parallelMap,
  parallelMethod,
} from './parallel';

// Caching decorators
export { cache, lazy, memoize } from './caching';

// Flow control decorators
export {
  circuitBreaker,
  concurrent,
  debounce,
  rateLimit,
  retry,
  throttle,
  timeout,
} from './flow-control';

// Export types from flow-control
export type { CircuitBreakerOptions, CircuitState } from './flow-control';

// Observability decorators
export { logged, measure, validate } from './observability';

// Export types from observability
export type { PerformanceStats, ValidatorFn } from './observability';

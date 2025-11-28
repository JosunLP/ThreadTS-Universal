/**
 * ThreadTS Universal - Flow Control Decorators
 *
 * Decorators for controlling method execution flow:
 * retry, rate limiting, timeout, debounce, throttle, circuit breaker, concurrent.
 * Supports both legacy (experimentalDecorators) and Stage-3 decorator syntax.
 *
 * @module decorators/flow-control
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

/**
 * Type for Stage-3 decorator context
 */
interface DecoratorContext {
  kind: 'method' | 'getter' | 'setter' | 'field' | 'class' | 'accessor';
  name: string | symbol;
  static: boolean;
  private: boolean;
  access?: {
    get?(): unknown;
    set?(value: unknown): void;
  };
  addInitializer?(initializer: () => void): void;
}

/**
 * Helper to create decorators compatible with both legacy and Stage-3 syntax
 */
function createMethodDecorator<T extends AnyFunction>(
  decoratorLogic: (originalMethod: T, methodName: string) => T
): (
  targetOrMethod: unknown,
  propertyKeyOrContext?: string | DecoratorContext,
  descriptor?: PropertyDescriptor
) => T | PropertyDescriptor | void {
  return function (
    targetOrMethod: unknown,
    propertyKeyOrContext?: string | DecoratorContext,
    descriptor?: PropertyDescriptor
  ): T | PropertyDescriptor | void {
    // Stage-3 decorator syntax: (method, context)
    if (
      typeof targetOrMethod === 'function' &&
      propertyKeyOrContext &&
      typeof propertyKeyOrContext === 'object' &&
      'kind' in propertyKeyOrContext
    ) {
      const context = propertyKeyOrContext as DecoratorContext;
      if (context.kind !== 'method') {
        throw new Error('Decorator can only be applied to methods');
      }
      const methodName = String(context.name);
      return decoratorLogic(targetOrMethod as T, methodName);
    }

    // Legacy decorator syntax: (target, propertyKey, descriptor)
    if (descriptor && typeof descriptor.value === 'function') {
      const methodName = String(propertyKeyOrContext);
      descriptor.value = decoratorLogic(descriptor.value as T, methodName);
      return descriptor;
    }

    throw new Error('Decorator can only be applied to methods');
  };
}

/**
 * Decorator for retry logic with exponential backoff
 */
export function retry(maxAttempts: number = 3, baseDelay: number = 1000) {
  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      let lastError: Error = new Error('Max attempts reached');

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt === maxAttempts) {
            throw lastError;
          }

          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Decorator for rate limiting method calls
 */
export function rateLimit(callsPerSecond: number = 10) {
  const queue: Array<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    args: unknown[];
    context: unknown;
  }> = [];
  const interval = 1000 / callsPerSecond;
  let lastCall = 0;
  let processing = false;

  return createMethodDecorator((originalMethod) => {
    async function processQueue() {
      if (processing || queue.length === 0) return;
      processing = true;

      while (queue.length > 0) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= interval) {
          const { resolve, reject, args, context } = queue.shift()!;
          lastCall = Date.now();

          try {
            const result = await originalMethod.apply(context, args);
            resolve(result);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        } else {
          // Wait for the remaining time
          await new Promise((resolve) =>
            setTimeout(resolve, interval - timeSinceLastCall)
          );
        }
      }

      processing = false;
    }

    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject, args, context: this });
        processQueue();
      });
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Decorator for timeout handling
 * Automatically rejects if execution exceeds the specified timeout
 */
export function timeout(ms: number = 5000) {
  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Operation timed out after ${ms}ms`)),
            ms
          )
        ),
      ]);
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Decorator for debouncing method calls
 * Delays execution until no calls have been made for the specified duration
 */
export function debounce(ms: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: unknown) => void) | null = null;
  let pendingReject: ((error: Error) => void) | null = null;

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      return new Promise((resolve, reject) => {
        // Clear previous timeout and reject pending promise
        if (timeoutId) {
          clearTimeout(timeoutId);
          if (pendingReject) {
            pendingReject(new Error('Debounced: superseded by new call'));
          }
        }

        pendingResolve = resolve;
        pendingReject = reject;

        timeoutId = setTimeout(async () => {
          try {
            const result = await originalMethod.apply(this, args);
            if (pendingResolve) {
              pendingResolve(result);
            }
          } catch (error) {
            if (pendingReject) {
              pendingReject(
                error instanceof Error ? error : new Error(String(error))
              );
            }
          } finally {
            timeoutId = null;
            pendingResolve = null;
            pendingReject = null;
          }
        }, ms);
      });
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Decorator for throttling method calls
 * Ensures the method is called at most once per specified interval
 */
export function throttle(ms: number = 300) {
  let lastCall = 0;
  let lastResult: unknown = undefined;

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const now = Date.now();

      if (now - lastCall >= ms) {
        lastCall = now;
        lastResult = await originalMethod.apply(this, args);
      }

      return lastResult;
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Decorator for limiting concurrent executions of a method.
 * Useful for controlling resource usage when calling expensive operations.
 *
 * @param maxConcurrent - Maximum number of concurrent executions (default: 1)
 *
 * @example
 * ```typescript
 * class FileProcessor {
 *   @concurrent(3) // Max 3 concurrent file operations
 *   async processFile(path: string): Promise<void> {
 *     await heavyFileOperation(path);
 *   }
 * }
 * ```
 */
export function concurrent(maxConcurrent: number = 1) {
  let currentCount = 0;
  const queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  const tryNext = () => {
    if (queue.length > 0 && currentCount < maxConcurrent) {
      currentCount++;
      const { resolve } = queue.shift()!;
      resolve();
    }
  };

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      // Wait for a slot to become available
      if (currentCount >= maxConcurrent) {
        await new Promise<void>((resolve, reject) => {
          queue.push({ resolve, reject });
        });
      } else {
        currentCount++;
      }

      try {
        return await originalMethod.apply(this, args);
      } finally {
        currentCount--;
        tryNext();
      }
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Circuit breaker state type
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 30000) */
  resetTimeout?: number;
  /** Number of test requests allowed in half-open state (default: 1) */
  halfOpenRequests?: number;
}

/**
 * Decorator for circuit breaker pattern.
 * Prevents repeated calls to a failing service.
 *
 * @param options - Circuit breaker configuration
 *
 * @example
 * ```typescript
 * class ApiService {
 *   @circuitBreaker({ failureThreshold: 5, resetTimeout: 30000 })
 *   async callExternalApi(): Promise<Data> {
 *     return await externalApi.getData();
 *   }
 * }
 * ```
 */
export function circuitBreaker(options: CircuitBreakerOptions = {}) {
  const {
    failureThreshold = 5,
    resetTimeout = 30000,
    halfOpenRequests = 1,
  } = options;

  let failures = 0;
  let lastFailureTime = 0;
  let state: CircuitState = 'closed';
  let halfOpenAttempts = 0;

  return createMethodDecorator((originalMethod, methodName) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const now = Date.now();

      // Check if circuit should be reset to half-open
      if (state === 'open' && now - lastFailureTime >= resetTimeout) {
        state = 'half-open';
        halfOpenAttempts = 0;
      }

      // Reject if circuit is open
      if (state === 'open') {
        throw new Error(
          `Circuit breaker is open for ${methodName}. Try again later.`
        );
      }

      // Limit requests in half-open state
      if (state === 'half-open' && halfOpenAttempts >= halfOpenRequests) {
        throw new Error(
          `Circuit breaker is half-open for ${methodName}. Too many test requests.`
        );
      }

      if (state === 'half-open') {
        halfOpenAttempts++;
      }

      try {
        const result = await originalMethod.apply(this, args);

        // Success - reset failures
        if (state === 'half-open') {
          state = 'closed';
        }
        failures = 0;

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (state === 'half-open' || failures >= failureThreshold) {
          state = 'open';
          console.warn(
            `Circuit breaker opened for ${methodName} after ${failures} failures`
          );
        }

        throw error;
      }
    };

    // Add method to get circuit state
    (wrappedMethod as { getState?: () => CircuitState }).getState = () => state;

    // Add method to reset circuit
    (wrappedMethod as { reset?: () => void }).reset = () => {
      state = 'closed';
      failures = 0;
      halfOpenAttempts = 0;
    };

    return wrappedMethod as typeof originalMethod;
  });
}

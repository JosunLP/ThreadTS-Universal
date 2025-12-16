/**
 * ThreadTS Universal - Observability Decorators
 *
 * Decorators for logging, measuring, and validating method execution.
 * Supports both legacy (experimentalDecorators) and Stage-3 decorator syntax.
 *
 * @module decorators/observability
 */

import { createMethodDecorator, createMethodDecoratorWithClass } from './utils';

/**
 * Decorator for logging method execution
 * Logs method calls, arguments, results, and execution time
 */
export function logged(
  options: { logArgs?: boolean; logResult?: boolean; logTiming?: boolean } = {}
) {
  const { logArgs = true, logResult = true, logTiming = true } = options;

  return createMethodDecoratorWithClass(
    (originalMethod, methodName, className) => {
      const wrappedMethod = async function (
        this: unknown,
        ...args: unknown[]
      ): Promise<unknown> {
        const startTime = Date.now();
        const argsLog = logArgs ? ` with args: ${JSON.stringify(args)}` : '';

        console.log(`[${className}.${methodName}] Starting${argsLog}`);

        try {
          const result = await originalMethod.apply(this, args);
          const duration = Date.now() - startTime;
          const timingLog = logTiming ? ` in ${duration}ms` : '';
          const resultLog = logResult
            ? ` Result: ${JSON.stringify(result)}`
            : '';

          console.log(
            `[${className}.${methodName}] Completed${timingLog}.${resultLog}`
          );

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const timingLog = logTiming ? ` after ${duration}ms` : '';
          console.error(
            `[${className}.${methodName}] Failed${timingLog}:`,
            error
          );
          throw error;
        }
      };

      return wrappedMethod as typeof originalMethod;
    }
  );
}

/**
 * Performance statistics type
 */
export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Decorator for measuring method performance.
 * Collects timing statistics across multiple calls.
 *
 * @example
 * ```typescript
 * class Calculator {
 *   @measure()
 *   async compute(data: number[]): Promise<number> {
 *     return data.reduce((a, b) => a + b, 0);
 *   }
 * }
 * // Access stats: Calculator.prototype.compute.getStats()
 * ```
 */
export function measure() {
  const timings: number[] = [];

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const start = performance.now();

      try {
        return await originalMethod.apply(this, args);
      } finally {
        const duration = performance.now() - start;
        timings.push(duration);

        // Keep only last 100 measurements
        if (timings.length > 100) {
          timings.shift();
        }
      }
    };

    // Add method to get statistics
    (wrappedMethod as { getStats?: () => PerformanceStats }).getStats = () => {
      if (timings.length === 0) {
        return {
          count: 0,
          min: 0,
          max: 0,
          avg: 0,
          median: 0,
          p95: 0,
          p99: 0,
        };
      }

      const sorted = [...timings].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);

      return {
        count: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: sum / sorted.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    };

    // Add method to clear statistics
    (wrappedMethod as { clearStats?: () => void }).clearStats = () => {
      timings.length = 0;
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Validator function type
 */
export type ValidatorFn = (arg: unknown) => boolean | string;

/**
 * Decorator for validating method arguments.
 * Throws an error if validation fails.
 *
 * @param validators - Array of validator functions for each argument
 *
 * @example
 * ```typescript
 * class UserService {
 *   @validate([
 *     (id) => typeof id === 'string' && id.length > 0,
 *     (data) => data && typeof data.name === 'string'
 *   ])
 *   async updateUser(id: string, data: UserData): Promise<void> {
 *     await api.updateUser(id, data);
 *   }
 * }
 * ```
 */
export function validate(validators: ValidatorFn[]) {
  return createMethodDecorator((originalMethod, methodName) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      for (let i = 0; i < validators.length; i++) {
        if (i >= args.length) break;

        const result = validators[i](args[i]);
        if (result === false) {
          throw new Error(
            `Validation failed for argument ${i} in ${methodName}`
          );
        }
        if (typeof result === 'string') {
          throw new Error(result);
        }
      }

      return originalMethod.apply(this, args);
    };

    return wrappedMethod as typeof originalMethod;
  });
}

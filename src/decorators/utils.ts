/**
 * ThreadTS Universal - Decorator Utilities
 *
 * Shared utilities for creating decorators that work with both
 * legacy (experimentalDecorators) and Stage-3 decorator syntax.
 *
 * @module decorators/utils
 * @author ThreadTS Universal Team
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;

/**
 * Type for Stage-3 decorator context.
 * Provides metadata about the decorated element.
 */
export interface DecoratorContext {
  /** The kind of element being decorated */
  kind: 'method' | 'getter' | 'setter' | 'field' | 'class' | 'accessor';
  /** The name of the decorated element */
  name: string | symbol;
  /** Whether the element is static */
  static: boolean;
  /** Whether the element is private */
  private: boolean;
  /** Access object for getting/setting the value */
  access?: {
    get?(): unknown;
    set?(value: unknown): void;
  };
  /** Function to add an initializer */
  addInitializer?(initializer: () => void): void;
}

/**
 * Return type for decorated methods.
 * Can be the wrapped function or a property descriptor.
 */
export type DecoratorReturnType<T extends AnyFunction> =
  | T
  | PropertyDescriptor
  | void;

/**
 * Helper to create method decorators compatible with both legacy and Stage-3 syntax.
 *
 * This factory function abstracts away the differences between the two decorator
 * syntaxes, allowing decorator authors to focus on the decoration logic.
 *
 * @template T - The function type being decorated
 * @param decoratorLogic - Function that wraps the original method
 * @returns A decorator function that works with both syntaxes
 *
 * @example
 * ```typescript
 * // Creating a simple logging decorator
 * function logCalls() {
 *   return createMethodDecorator((originalMethod, methodName) => {
 *     return async function(...args: unknown[]) {
 *       console.log(`Calling ${methodName}`);
 *       const result = await originalMethod.apply(this, args);
 *       console.log(`${methodName} returned:`, result);
 *       return result;
 *     } as typeof originalMethod;
 *   });
 * }
 * ```
 */
export function createMethodDecorator<T extends AnyFunction>(
  decoratorLogic: (originalMethod: T, methodName: string) => T
): (
  targetOrMethod: unknown,
  propertyKeyOrContext?: string | symbol | DecoratorContext,
  descriptor?: PropertyDescriptor
) => DecoratorReturnType<T> {
  return function (
    targetOrMethod: unknown,
    propertyKeyOrContext?: string | symbol | DecoratorContext,
    descriptor?: PropertyDescriptor
  ): DecoratorReturnType<T> {
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
 * Helper to create method decorators that also receive the class name.
 * Compatible with both legacy and Stage-3 syntax.
 *
 * This is useful for logging and observability decorators that need
 * to know which class the method belongs to.
 *
 * @template T - The function type being decorated
 * @param decoratorLogic - Function that wraps the original method, receiving class name
 * @returns A decorator function that works with both syntaxes
 *
 * @example
 * ```typescript
 * function logMethod() {
 *   return createMethodDecoratorWithClass((method, methodName, className) => {
 *     return async function(...args: unknown[]) {
 *       console.log(`[${className}.${methodName}] called`);
 *       return method.apply(this, args);
 *     } as typeof method;
 *   });
 * }
 * ```
 */
export function createMethodDecoratorWithClass<T extends AnyFunction>(
  decoratorLogic: (
    originalMethod: T,
    methodName: string,
    className: string
  ) => T
): (
  targetOrMethod: unknown,
  propertyKeyOrContext?: string | symbol | DecoratorContext,
  descriptor?: PropertyDescriptor
) => DecoratorReturnType<T> {
  return function (
    targetOrMethod: unknown,
    propertyKeyOrContext?: string | symbol | DecoratorContext,
    descriptor?: PropertyDescriptor
  ): DecoratorReturnType<T> {
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
      // In Stage-3, class name isn't directly available in context
      return decoratorLogic(targetOrMethod as T, methodName, 'Unknown');
    }

    // Legacy decorator syntax: (target, propertyKey, descriptor)
    if (descriptor && typeof descriptor.value === 'function') {
      const methodName = String(propertyKeyOrContext);
      const className =
        (targetOrMethod as { constructor?: { name?: string } })?.constructor
          ?.name || 'Unknown';
      descriptor.value = decoratorLogic(
        descriptor.value as T,
        methodName,
        className
      );
      return descriptor;
    }

    throw new Error('Decorator can only be applied to methods');
  };
}

/**
 * Helper to create class decorators compatible with both legacy and Stage-3 syntax.
 *
 * @template T - The class constructor type
 * @param decoratorLogic - Function that wraps the original class
 * @returns A decorator function that works with both syntaxes
 */
export function createClassDecorator<
  T extends new (...args: unknown[]) => object,
>(
  decoratorLogic: (originalClass: T, className: string) => T
): (target: T) => T {
  return function (target: T): T {
    const className = target.name || 'AnonymousClass';
    return decoratorLogic(target, className);
  };
}

/**
 * Type guard to check if a value is an async function.
 *
 * @param fn - The value to check
 * @returns true if the value is an async function
 */
export function isAsyncFunction(
  fn: unknown
): fn is (...args: unknown[]) => Promise<unknown> {
  return (
    typeof fn === 'function' &&
    (fn.constructor.name === 'AsyncFunction' ||
      fn.toString().startsWith('async'))
  );
}

/**
 * Ensures a function returns a Promise.
 * Wraps synchronous functions to return Promise.resolve(result).
 *
 * @param fn - The function to wrap
 * @returns A function that always returns a Promise
 */
export function ensureAsync<T extends AnyFunction>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async function (
    this: unknown,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> {
    return fn.apply(this, args);
  };
}

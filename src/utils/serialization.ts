/**
 * ThreadTS Universal - Serialization Utilities
 * Handles function and data serialization across different platforms
 */

import {
  SerializableData,
  SerializableFunction,
  SerializationError,
  TypedArray,
} from '../types';

/**
 * Serializes a function for worker execution
 */
export function serializeFunction(fn: SerializableFunction): string {
  if (typeof fn !== 'function') {
    throw new SerializationError('Input must be a function');
  }

  const fnString = fn.toString();

  // Handle arrow functions and regular functions
  if (fnString.includes('=>') || fnString.startsWith('function')) {
    return fnString;
  }

  // Handle method definitions
  if (fnString.includes('(') && fnString.includes('{')) {
    return `function ${fnString}`;
  }

  throw new SerializationError('Unable to serialize function');
}

/**
 * Deserializes a function string back to a function
 */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
export function deserializeFunction(fnString: string): SerializableFunction {
  try {
    // Use Function constructor for safe evaluation
    return new Function('return (' + fnString + ')')();
  } catch (error) {
    throw new SerializationError(
      'Failed to deserialize function',
      error as Error
    );
  }
}

/**
 * Serializes data for worker transfer
 */
export function serializeData(data: SerializableData): {
  serialized: string;
  transferables: Transferable[];
} {
  const transferables: Transferable[] = [];

  try {
    // Handle transferable objects
    const processed = processTransferables(data, transferables);

    return {
      serialized: JSON.stringify(processed),
      transferables,
    };
  } catch (error) {
    throw new SerializationError('Failed to serialize data', error as Error);
  }
}

/**
 * Deserializes data from worker
 */
export function deserializeData(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch (error) {
    throw new SerializationError('Failed to deserialize data', error as Error);
  }
}

/**
 * Processes data to extract transferable objects
 */
function processTransferables(
  obj: unknown,
  transferables: Transferable[]
): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle ArrayBuffer
  if (obj instanceof ArrayBuffer) {
    transferables.push(obj);
    return { __type: 'ArrayBuffer', __data: obj };
  }

  // Handle TypedArrays
  if (ArrayBuffer.isView(obj)) {
    const typedArray = obj as TypedArray;
    const buffer = typedArray.buffer.slice(
      typedArray.byteOffset,
      typedArray.byteOffset + typedArray.byteLength
    );
    transferables.push(buffer);
    return {
      __type: typedArray.constructor.name,
      __data: buffer,
      __byteOffset: typedArray.byteOffset,
      __length: typedArray.length,
    };
  }

  // Handle MessagePort
  if (typeof MessagePort !== 'undefined' && obj instanceof MessagePort) {
    transferables.push(obj);
    return { __type: 'MessagePort', __data: obj };
  }

  // Handle OffscreenCanvas
  if (
    typeof OffscreenCanvas !== 'undefined' &&
    obj instanceof OffscreenCanvas
  ) {
    transferables.push(obj);
    return { __type: 'OffscreenCanvas', __data: obj };
  }

  // Handle ImageBitmap
  if (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap) {
    transferables.push(obj);
    return { __type: 'ImageBitmap', __data: obj };
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => processTransferables(item, transferables));
  }

  // Handle Objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = processTransferables(value, transferables);
  }

  return result;
}

/**
 * Restores transferable objects after deserialization
 */
export function restoreTransferables(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const typedObj = obj as Record<string, unknown>;

  // Handle special transferable markers
  if (typedObj.__type) {
    switch (typedObj.__type) {
      case 'ArrayBuffer':
        return typedObj.__data;

      case 'MessagePort':
        return typedObj.__data;

      case 'OffscreenCanvas':
        return typedObj.__data;

      case 'ImageBitmap':
        return typedObj.__data;

      // Handle TypedArrays
      case 'Int8Array':
      case 'Uint8Array':
      case 'Uint8ClampedArray':
      case 'Int16Array':
      case 'Uint16Array':
      case 'Int32Array':
      case 'Uint32Array':
      case 'Float32Array':
      case 'Float64Array':
      case 'BigInt64Array':
      case 'BigUint64Array': {
        const TypedArrayConstructor = (globalThis as Record<string, unknown>)[
          typedObj.__type as string
        ] as new (buffer: ArrayBuffer) => TypedArray;
        return new TypedArrayConstructor(typedObj.__data as ArrayBuffer);
      }
    }
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(restoreTransferables);
  }

  // Handle Objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = restoreTransferables(value);
  }

  return result;
}

/**
 * Checks if an object contains transferable objects
 */
export function hasTransferables(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  // Check for transferable types
  if (
    obj instanceof ArrayBuffer ||
    ArrayBuffer.isView(obj) ||
    (typeof MessagePort !== 'undefined' && obj instanceof MessagePort) ||
    (typeof OffscreenCanvas !== 'undefined' &&
      obj instanceof OffscreenCanvas) ||
    (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap)
  ) {
    return true;
  }

  // Recursively check arrays and objects
  if (Array.isArray(obj)) {
    return obj.some(hasTransferables);
  }

  return Object.values(obj).some(hasTransferables);
}

/**
 * Creates a worker script string with the function and data
 */
export function createWorkerScript(
  fn: SerializableFunction,
  data: unknown,
  options: { timeout?: number } = {}
): string {
  const fnString = serializeFunction(fn);
  const { serialized: dataString } = serializeData(data as SerializableData);

  return `
    // ThreadTS Universal Worker Script
    const { deserializeData, restoreTransferables, serializeData } = {
      deserializeData: ${deserializeData.toString()},
      restoreTransferables: ${restoreTransferables.toString()},
      serializeData: ${serializeData.toString()}
    };

    const fn = ${fnString};
    const data = restoreTransferables(deserializeData('${dataString}'));

    ${
      options.timeout
        ? `
    const timeoutId = setTimeout(() => {
      postMessage({ error: 'Operation timed out after ${options.timeout}ms' });
    }, ${options.timeout});
    `
        : ''
    }

    try {
      const startTime = performance.now();
      const result = fn(data);
      const executionTime = performance.now() - startTime;

      ${options.timeout ? 'clearTimeout(timeoutId);' : ''}

      if (result instanceof Promise) {
        result
          .then(asyncResult => {
            const { serialized } = serializeData(asyncResult);
            postMessage({
              result: asyncResult,
              executionTime: performance.now() - startTime,
              serialized
            });
          })
          .catch(error => {
            postMessage({
              error: error.message || 'Unknown error in async function',
              executionTime: performance.now() - startTime
            });
          });
      } else {
        const { serialized } = serializeData(result);
        postMessage({
          result,
          executionTime,
          serialized
        });
      }
    } catch (error) {
      ${options.timeout ? 'clearTimeout(timeoutId);' : ''}
      postMessage({
        error: error.message || 'Unknown error',
        executionTime: performance.now() - startTime
      });
    }
  `;
}

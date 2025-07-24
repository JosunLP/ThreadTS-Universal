"use strict";
/**
 * ThreadJS Universal - Serialization Utilities
 * Handles function and data serialization across different platforms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkerScript = exports.hasTransferables = exports.restoreTransferables = exports.deserializeData = exports.serializeData = exports.deserializeFunction = exports.serializeFunction = void 0;
const types_1 = require("../types");
/**
 * Serializes a function for worker execution
 */
function serializeFunction(fn) {
    if (typeof fn !== 'function') {
        throw new types_1.SerializationError('Input must be a function');
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
    throw new types_1.SerializationError('Unable to serialize function');
}
exports.serializeFunction = serializeFunction;
/**
 * Deserializes a function string back to a function
 */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
function deserializeFunction(fnString) {
    try {
        // Use Function constructor for safe evaluation
        return new Function('return (' + fnString + ')')();
    }
    catch (error) {
        throw new types_1.SerializationError('Failed to deserialize function', error);
    }
}
exports.deserializeFunction = deserializeFunction;
/**
 * Serializes data for worker transfer
 */
function serializeData(data) {
    const transferables = [];
    try {
        // Handle transferable objects
        const processed = processTransferables(data, transferables);
        return {
            serialized: JSON.stringify(processed),
            transferables,
        };
    }
    catch (error) {
        throw new types_1.SerializationError('Failed to serialize data', error);
    }
}
exports.serializeData = serializeData;
/**
 * Deserializes data from worker
 */
function deserializeData(serialized) {
    try {
        return JSON.parse(serialized);
    }
    catch (error) {
        throw new types_1.SerializationError('Failed to deserialize data', error);
    }
}
exports.deserializeData = deserializeData;
/**
 * Processes data to extract transferable objects
 */
function processTransferables(obj, transferables) {
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
        const buffer = obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength);
        transferables.push(buffer);
        return {
            __type: obj.constructor.name,
            __data: buffer,
            __byteOffset: obj.byteOffset,
            __length: obj.length,
        };
    }
    // Handle MessagePort
    if (typeof MessagePort !== 'undefined' && obj instanceof MessagePort) {
        transferables.push(obj);
        return { __type: 'MessagePort', __data: obj };
    }
    // Handle OffscreenCanvas
    if (typeof OffscreenCanvas !== 'undefined' &&
        obj instanceof OffscreenCanvas) {
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
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = processTransferables(value, transferables);
    }
    return result;
}
/**
 * Restores transferable objects after deserialization
 */
function restoreTransferables(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // Handle special transferable markers
    if (obj.__type) {
        switch (obj.__type) {
            case 'ArrayBuffer':
                return obj.__data;
            case 'MessagePort':
                return obj.__data;
            case 'OffscreenCanvas':
                return obj.__data;
            case 'ImageBitmap':
                return obj.__data;
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
            case 'BigUint64Array':
                const TypedArrayConstructor = globalThis[obj.__type];
                return new TypedArrayConstructor(obj.__data);
        }
    }
    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(restoreTransferables);
    }
    // Handle Objects
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = restoreTransferables(value);
    }
    return result;
}
exports.restoreTransferables = restoreTransferables;
/**
 * Checks if an object contains transferable objects
 */
function hasTransferables(obj) {
    if (obj === null || typeof obj !== 'object') {
        return false;
    }
    // Check for transferable types
    if (obj instanceof ArrayBuffer ||
        ArrayBuffer.isView(obj) ||
        (typeof MessagePort !== 'undefined' && obj instanceof MessagePort) ||
        (typeof OffscreenCanvas !== 'undefined' &&
            obj instanceof OffscreenCanvas) ||
        (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap)) {
        return true;
    }
    // Recursively check arrays and objects
    if (Array.isArray(obj)) {
        return obj.some(hasTransferables);
    }
    return Object.values(obj).some(hasTransferables);
}
exports.hasTransferables = hasTransferables;
/**
 * Creates a worker script string with the function and data
 */
function createWorkerScript(fn, data, options = {}) {
    const fnString = serializeFunction(fn);
    const { serialized: dataString } = serializeData(data);
    return `
    // ThreadJS Universal Worker Script
    const { deserializeData, restoreTransferables, serializeData } = {
      deserializeData: ${deserializeData.toString()},
      restoreTransferables: ${restoreTransferables.toString()},
      serializeData: ${serializeData.toString()}
    };

    const fn = ${fnString};
    const data = restoreTransferables(deserializeData('${dataString}'));

    ${options.timeout
        ? `
    const timeoutId = setTimeout(() => {
      postMessage({ error: 'Operation timed out after ${options.timeout}ms' });
    }, ${options.timeout});
    `
        : ''}

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
exports.createWorkerScript = createWorkerScript;

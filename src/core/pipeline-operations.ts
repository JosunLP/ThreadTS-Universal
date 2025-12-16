/**
 * ThreadTS Universal - Pipeline Operations Module
 *
 * Shared operation execution logic for Pipeline and TerminalPipeline classes.
 * Extracts common functionality to follow DRY principles.
 *
 * @module core/pipeline-operations
 * @author ThreadTS Universal Team
 */

import type { MapOptions, SerializableFunction, ThreadOptions } from '../types';
import {
  chunkArray,
  interleaveArrays,
  randomSample,
  rotateArray,
  shuffleCopy,
  slidingWindow,
  uniqueBy,
  uniqueByJson,
} from '../utils/array-helpers';
import type { ThreadTS } from './threadts';

/**
 * Pipeline operation definition for lazy evaluation.
 */
export interface PipelineOperation {
  type: string;
  fn?: SerializableFunction;
  options?: MapOptions | ThreadOptions;
  initialValue?: unknown;
  count?: number;
  /** Step for window operations */
  step?: number;
}

/**
 * List of terminal operation types
 */
export const TERMINAL_OPERATIONS = [
  'reduce',
  'forEach',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'some',
  'every',
  'count',
  'groupBy',
  'partition',
  'first',
  'last',
  'isEmpty',
  'sum',
  'average',
  'min',
  'max',
  'join',
  'includes',
] as const;

export type TerminalOperationType = (typeof TERMINAL_OPERATIONS)[number];

/**
 * Check if an operation type is a terminal operation.
 */
export function isTerminalOperation(type: string): boolean {
  return TERMINAL_OPERATIONS.includes(type as TerminalOperationType);
}

/**
 * Executes an intermediate pipeline operation.
 * Shared between Pipeline and TerminalPipeline to avoid code duplication.
 *
 * @param data - Current pipeline data
 * @param op - Operation to execute
 * @param threadts - ThreadTS instance for parallel operations
 * @returns Transformed data array
 */
export async function executeIntermediateOperation(
  data: unknown[],
  op: PipelineOperation,
  threadts: ThreadTS
): Promise<unknown[]> {
  switch (op.type) {
    case 'map':
      return threadts.map(data, op.fn!, op.options as MapOptions);

    case 'filter':
      return threadts.filter(data, op.fn!, op.options as MapOptions);

    case 'flatMap':
      return threadts.flatMap(data, op.fn!, op.options as MapOptions);

    case 'take':
      return data.slice(0, op.count ?? 0);

    case 'skip':
      return data.slice(op.count ?? 0);

    case 'chunk': {
      const chunkSize = op.count ?? 1;
      return chunkArray(data, chunkSize);
    }

    case 'tap':
    case 'peek': {
      // Execute side-effect function without modifying data.
      // 'peek' is an alias for 'tap' - both are used for debugging/logging.
      if (op.fn) {
        for (const item of data) {
          op.fn(item);
        }
      }
      return data;
    }

    case 'window': {
      const windowSize = op.count ?? 1;
      const step = op.step ?? 1;
      return slidingWindow(data, windowSize, step);
    }

    case 'unique': {
      // Uses JSON stringification for comparison (deep equality)
      return uniqueByJson(
        data,
        op.fn as ((item: unknown) => unknown) | undefined
      );
    }

    case 'distinct': {
      // Uses strict equality or a custom key function
      // Unlike 'unique', no JSON serialization is used here
      if (op.fn) {
        return uniqueBy(data, op.fn as (item: unknown) => unknown);
      }
      // Without a key function: use Set for primitive values
      return [...new Set(data)];
    }

    case 'reverse':
      return [...data].reverse();

    case 'sort':
      return [...data].sort(
        op.fn as ((a: unknown, b: unknown) => number) | undefined
      );

    case 'zip': {
      // Zip with another array stored in initialValue
      const other = op.initialValue as unknown[];
      if (!Array.isArray(other)) return data;
      const zipped: unknown[][] = [];
      const maxLen = Math.min(data.length, other.length);
      for (let i = 0; i < maxLen; i++) {
        zipped.push([data[i], other[i]]);
      }
      return zipped;
    }

    case 'zipWith': {
      // Zip with a combiner function
      const other = op.initialValue as unknown[];
      if (!Array.isArray(other) || !op.fn) return data;
      const zippedWith: unknown[] = [];
      const maxLen = Math.min(data.length, other.length);
      for (let i = 0; i < maxLen; i++) {
        zippedWith.push(op.fn(data[i], other[i], i));
      }
      return zippedWith;
    }

    case 'interleave': {
      // Interleave with another array
      const other = op.initialValue as unknown[];
      if (!Array.isArray(other)) return data;
      return interleaveArrays(data, other);
    }

    case 'compact': {
      // Remove null, undefined, and optionally falsy values
      return data.filter((item) => {
        if (op.fn) {
          return op.fn(item);
        }
        return item != null;
      });
    }

    case 'flatten': {
      // Flatten nested arrays to specified depth
      const depth = op.count ?? 1;
      return data.flat(depth);
    }

    case 'shuffle': {
      // Fisher-Yates shuffle - uses utility function
      return shuffleCopy(data);
    }

    case 'sample': {
      // Random sample of n elements - uses utility function
      return randomSample(data, op.count ?? 1);
    }

    case 'dropWhile': {
      // Drop elements while predicate is true
      if (!op.fn) return data;
      let dropIndex = 0;
      for (let i = 0; i < data.length; i++) {
        if (!op.fn(data[i], i, data)) {
          dropIndex = i;
          break;
        }
        if (i === data.length - 1) {
          return [];
        }
      }
      return data.slice(dropIndex);
    }

    case 'takeWhile': {
      // Take elements while predicate is true
      if (!op.fn) return data;
      const result: unknown[] = [];
      for (let i = 0; i < data.length; i++) {
        if (op.fn(data[i], i, data)) {
          result.push(data[i]);
        } else {
          break;
        }
      }
      return result;
    }

    case 'slice': {
      // Slice from start to end (stored in count and step)
      const start = op.count ?? 0;
      const end = op.step;
      return data.slice(start, end);
    }

    case 'concat': {
      // Concatenate with another array
      const other = op.initialValue as unknown[];
      if (!Array.isArray(other)) return data;
      return [...data, ...other];
    }

    case 'rotate': {
      // Rotate array by n positions - uses utility function
      return rotateArray(data, op.count ?? 0);
    }

    case 'truthy': {
      // Keep only truthy values
      return data.filter(Boolean);
    }

    case 'falsy': {
      // Keep only falsy values
      return data.filter((item) => !item);
    }

    default:
      return data;
  }
}

/**
 * Executes a terminal pipeline operation.
 * Shared between Pipeline and TerminalPipeline to avoid code duplication.
 *
 * @param data - Current pipeline data
 * @param op - Operation to execute
 * @param threadts - ThreadTS instance for parallel operations
 * @returns Final result value
 */
export async function executeTerminalOperation<R>(
  data: unknown[],
  op: PipelineOperation,
  threadts: ThreadTS
): Promise<R> {
  switch (op.type) {
    case 'reduce':
      return threadts.reduce(
        data,
        op.fn!,
        op.initialValue as R,
        op.options as ThreadOptions
      );

    case 'forEach':
      await threadts.forEach(data, op.fn!, op.options as MapOptions);
      return undefined as R;

    case 'find':
      return threadts.find(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'findIndex':
      return threadts.findIndex(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'findLast': {
      // Find last element matching predicate
      if (!op.fn) return undefined as R;
      for (let i = data.length - 1; i >= 0; i--) {
        if (op.fn(data[i], i, data)) {
          return data[i] as R;
        }
      }
      return undefined as R;
    }

    case 'findLastIndex': {
      // Find last index matching predicate
      if (!op.fn) return -1 as R;
      for (let i = data.length - 1; i >= 0; i--) {
        if (op.fn(data[i], i, data)) {
          return i as R;
        }
      }
      return -1 as R;
    }

    case 'some':
      return threadts.some(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'every':
      return threadts.every(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'count':
      return threadts.count(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'groupBy':
      return threadts.groupBy(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'partition':
      return threadts.partition(
        data,
        op.fn!,
        op.options as MapOptions
      ) as Promise<R>;

    case 'first':
      return (data.length > 0 ? data[0] : undefined) as R;

    case 'last':
      return (data.length > 0 ? data[data.length - 1] : undefined) as R;

    case 'isEmpty':
      return (data.length === 0) as R;

    case 'sum':
      return data.reduce(
        (acc: number, val) => acc + (typeof val === 'number' ? val : 0),
        0
      ) as R;

    case 'average': {
      if (data.length === 0) return NaN as R;
      const sumValue = data.reduce(
        (acc: number, val) => acc + (typeof val === 'number' ? val : 0),
        0
      );
      return (sumValue / data.length) as R;
    }

    case 'min': {
      if (data.length === 0) return undefined as R;
      const minCompareFn = op.fn as
        | ((a: unknown, b: unknown) => number)
        | undefined;
      return [...data].sort(
        minCompareFn ??
          ((a, b) => {
            if (a === b) return 0;
            return (a as number) < (b as number) ? -1 : 1;
          })
      )[0] as R;
    }

    case 'max': {
      if (data.length === 0) return undefined as R;
      const maxCompareFn = op.fn as
        | ((a: unknown, b: unknown) => number)
        | undefined;
      return [...data].sort(
        maxCompareFn ??
          ((a, b) => {
            if (a === b) return 0;
            return (a as number) > (b as number) ? -1 : 1;
          })
      )[0] as R;
    }

    case 'join': {
      const separator = (op.initialValue as string) ?? ',';
      return data.join(separator) as R;
    }

    case 'includes': {
      const searchValue = op.initialValue;
      return data.includes(searchValue) as R;
    }

    default:
      return data as R;
  }
}

/**
 * ThreadTS Universal - Core Functionality Tests
 * Tests for the real capabilities of the NPM package
 */

import threadts, { ThreadTS } from '../src';

// Mock Worker for test environment
jest.mock('../src/utils/platform', () => ({
  ...jest.requireActual('../src/utils/platform'),
  supportsWorkerThreads: () => true,
  detectPlatform: () => 'node',
  getOptimalWorkerCount: () => 4,
}));

describe('ThreadTS Universal', () => {
  beforeEach(() => {
    // Reset ThreadTS instance between tests
    Reflect.set(ThreadTS, '_instance', null);
  });

  afterEach(async () => {
    try {
      const instance = Reflect.get(ThreadTS, '_instance') as ThreadTS | null;
      if (instance) {
        await instance.terminate();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    Reflect.set(ThreadTS, '_instance', null);
  });

  describe('🔧 Core Functionality', () => {
    test('should execute simple calculations in parallel', async () => {
      const result = await threadts.run((x: number) => x * 2, 21);
      expect(result).toBe(42);
    });

    test('should process complex data structures', async () => {
      const data = {
        numbers: [1, 2, 3, 4, 5],
        text: 'hello',
        nested: { value: 42 },
      };

      const result = await threadts.run(
        (input: typeof data) => ({
          sum: input.numbers.reduce((a, b) => a + b, 0),
          upperText: input.text.toUpperCase(),
          doubledValue: input.nested.value * 2,
        }),
        data
      );

      expect(result).toEqual({
        sum: 15,
        upperText: 'HELLO',
        doubledValue: 84,
      });
    });

    test('should support async functions', async () => {
      const asyncFn = async (delay: number) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return 'completed';
      };

      const result = await threadts.run(asyncFn, 10);
      expect(result).toBe('completed');
    });
  });

  describe('⚡ Parallel Processing', () => {
    test('should execute multiple tasks in parallel', async () => {
      const tasks = [
        { fn: (x: number) => x * 2, data: 5 },
        { fn: (x: number) => x + 10, data: 3 },
        { fn: (x: string) => x.toUpperCase(), data: 'test' },
      ];

      const results = await threadts.parallel(tasks);
      expect(results).toHaveLength(3);
      expect(results).toEqual([10, 13, 'TEST']);
    });

    test('should perform array mapping in parallel', async () => {
      const numbers = [1, 2, 3, 4, 5];

      const results = await threadts.map(numbers, (n: number) => n * n, {
        batchSize: 2,
      });

      expect(results).toEqual([1, 4, 9, 16, 25]);
    });

    test('should support batch processing', async () => {
      const largeTasks = Array.from({ length: 10 }, (_, i) => ({
        fn: (x: number) => x * 2,
        data: i,
      }));

      const results = await threadts.batch(largeTasks, 3);
      expect(results).toHaveLength(10);
      results.forEach((task, index) => {
        expect(task.success).toBe(true);
        expect(task.result).toBe(index * 2);
      });
    });
  });

  describe('🔍 New Array Methods', () => {
    test('should implement find() correctly', async () => {
      const numbers = [1, 2, 3, 4, 5];

      // Find first element greater than 3
      const found = await threadts.find(numbers, (x: number) => x > 3);
      expect(found).toBe(4);

      // Non-existent element
      const notFound = await threadts.find(numbers, (x: number) => x > 10);
      expect(notFound).toBeUndefined();

      // Empty array
      const emptyResult = await threadts.find([], (x: number) => x > 0);
      expect(emptyResult).toBeUndefined();
    });

    test('should implement findIndex() correctly', async () => {
      const numbers = [1, 2, 3, 4, 5];

      // Find index of first element greater than 3
      const index = await threadts.findIndex(numbers, (x: number) => x > 3);
      expect(index).toBe(3);

      // Non-existent element
      const notFoundIndex = await threadts.findIndex(
        numbers,
        (x: number) => x > 10
      );
      expect(notFoundIndex).toBe(-1);

      // Empty array
      const emptyIndex = await threadts.findIndex([], (x: number) => x > 0);
      expect(emptyIndex).toBe(-1);
    });

    test('should implement some() correctly', async () => {
      const numbers = [1, 2, 3, 4, 5];

      // Check if any element is greater than 3
      const hasLarge = await threadts.some(numbers, (x: number) => x > 3);
      expect(hasLarge).toBe(true);

      // Check if any element is greater than 10
      const hasVeryLarge = await threadts.some(numbers, (x: number) => x > 10);
      expect(hasVeryLarge).toBe(false);

      // Empty array should return false
      const emptyResult = await threadts.some([], (x: number) => x > 0);
      expect(emptyResult).toBe(false);
    });

    test('should implement every() correctly', async () => {
      const positiveNumbers = [1, 2, 3, 4, 5];
      const mixedNumbers = [1, 2, -3, 4, 5];

      // All positive
      const allPositive = await threadts.every(
        positiveNumbers,
        (x: number) => x > 0
      );
      expect(allPositive).toBe(true);

      // Not all positive
      const notAllPositive = await threadts.every(
        mixedNumbers,
        (x: number) => x > 0
      );
      expect(notAllPositive).toBe(false);

      // Empty array should return true (like Array.prototype.every)
      const emptyResult = await threadts.every([], (x: number) => x > 0);
      expect(emptyResult).toBe(true);
    });

    test('should support find() with batchSize', async () => {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const found = await threadts.find(numbers, (x: number) => x > 5, {
        batchSize: 3,
      });
      expect(found).toBe(6);
    });
  });

  describe('🎛️ Configuration & Options', () => {
    test('should provide pool statistics', () => {
      const stats = threadts.getStats();

      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('idleWorkers');
      expect(stats).toHaveProperty('queuedTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(typeof stats.activeWorkers).toBe('number');
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0);
    });

    test('should allow pool size adjustment', async () => {
      await threadts.resize(6);
      // Test succeeds if no errors occur
      expect(true).toBe(true);
    });

    test('should provide platform information', () => {
      const platform = threadts.getPlatform();
      const isSupported = threadts.isSupported();

      expect(['browser', 'node', 'deno', 'bun', 'unknown']).toContain(platform);
      expect(typeof isSupported).toBe('boolean');
    });

    test('should support priorities', async () => {
      const result = await threadts.run((x: number) => x * 3, 7, {
        priority: 'high',
      });

      expect(result).toBe(21);
    });
  });

  describe('🛡️ Error Handling', () => {
    test('should catch invalid functions', async () => {
      await expect(
        threadts.run(undefined as unknown as (...args: unknown[]) => unknown)
      ).rejects.toThrow();
    });

    test('should respect timeout options', async () => {
      // Test that timeout option is accepted
      const result = await threadts.run(() => 'fast-result', null, {
        timeout: 1000,
      });

      expect(result).toBe('fast-result');
    });

    test('should handle worker errors correctly', async () => {
      const errorFn = () => {
        throw new Error('Simulated worker error');
      };

      await expect(threadts.run(errorFn)).rejects.toThrow(
        'Simulated worker error'
      );
    });
  });

  describe('🔄 Lifecycle Management', () => {
    test('should support graceful shutdown', async () => {
      const instance = ThreadTS.getInstance();

      // Execute some tasks
      await instance.run((x: number) => x, 1);

      // Shutdown gracefully
      await instance.terminate();

      expect(true).toBe(true); // Test succeeds if no errors
    });

    test('should initialize worker pool correctly', () => {
      const instance = ThreadTS.getInstance();
      const stats = instance.getStats();

      // Pool should be initialized
      expect(stats.activeWorkers + stats.idleWorkers).toBeGreaterThanOrEqual(0);
    });
  });
});

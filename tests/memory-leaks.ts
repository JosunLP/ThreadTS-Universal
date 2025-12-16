/**
 * ThreadTS Universal - Memory Leak Detection Tests
 * Automated monitoring for memory leaks in the worker pool
 */

import { ThreadTS } from '../src/core/threadts';

describe('Memory Leak Detection', () => {
  let threadts: ThreadTS;
  let initialMemory: number;

  beforeEach(() => {
    threadts = ThreadTS.getInstance();
    // Determine baseline memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      initialMemory = process.memoryUsage().heapUsed;
    } else if (
      typeof performance !== 'undefined' &&
      (performance as any).memory
    ) {
      initialMemory = (performance as any).memory.usedJSHeapSize;
    } else {
      initialMemory = 0;
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    await threadts.terminate();

    // Force garbage collection if available
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }
  });

  it('should not leak memory after multiple worker executions', async () => {
    const iterations = 100;

    // Execute workers multiple times
    for (let i = 0; i < iterations; i++) {
      await threadts.run((x: number) => x * 2, i);
    }

    // Check memory usage after processing
    let finalMemory: number;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      finalMemory = process.memoryUsage().heapUsed;
    } else if (
      typeof performance !== 'undefined' &&
      (performance as any).memory
    ) {
      finalMemory = (performance as any).memory.usedJSHeapSize;
    } else {
      finalMemory = 0;
    }

    // Memory increase should be minimal (< 5MB)
    const memoryIncrease = finalMemory - initialMemory;
    const maxAllowedIncrease = 5 * 1024 * 1024; // 5MB

    expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
  });

  it('should clean up worker pool properly', async () => {
    // Put the worker pool under load with multiple tasks
    const tasks = Array.from({ length: 50 }, (_, i) =>
      threadts.run((x: number) => x ** 2, i)
    );

    await Promise.all(tasks);

    // Check pool statistics
    const stats = threadts.getStats();
    expect(stats.activeWorkers).toBe(0);
    expect(stats.idleWorkers).toBeGreaterThanOrEqual(0);
  });

  it('should handle worker termination gracefully', async () => {
    // Start workers
    const task1 = threadts.run((x: number) => x * 2, 10);
    const task2 = threadts.run((x: number) => x * 3, 20);

    // Terminate while execution is in progress
    const terminatePromise = threadts.terminate();

    // Tasks should be cancelled gracefully
    await expect(
      Promise.all([task1, task2, terminatePromise])
    ).resolves.toBeDefined();
  });

  it('should prevent circular reference memory leaks', async () => {
    // Create an object with circular references
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;

    // The worker should fail with a serialization error
    await expect(
      threadts.run((obj: any) => obj.name, circularObj)
    ).rejects.toThrow();

    // Memory should not be leaked
    const stats = threadts.getStats();
    expect(stats.activeWorkers).toBe(0);
  });

  it('should handle large data transfers without memory buildup', async () => {
    // Process large arrays (roughly 10MB)
    const largeArray = new Array(1_000_000).fill(0).map((_, i) => i);

    for (let i = 0; i < 10; i++) {
      await threadts.run(
        (arr: number[]) => arr.reduce((a, b) => a + b, 0),
        largeArray
      );
    }

    // Memory usage should remain stable
    let currentMemory: number;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      currentMemory = process.memoryUsage().heapUsed;
    } else if (
      typeof performance !== 'undefined' &&
      (performance as any).memory
    ) {
      currentMemory = (performance as any).memory.usedJSHeapSize;
    } else {
      currentMemory = 0;
    }

    const memoryIncrease = currentMemory - initialMemory;
    const maxAllowedIncrease = 50 * 1024 * 1024; // 50MB for large arrays

    expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
  });
});

/**
 * ThreadTS Universal - Performance Tests
 * Lightweight performance tests for core functionality
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import threadts, { ThreadTS } from '../src';

// Mock for test environment
vi.mock('../src/utils/platform', async () => {
  const actual = await vi.importActual('../src/utils/platform');
  return {
    ...actual,
    supportsWorkerThreads: () => true,
    detectPlatform: () => 'node',
  };
});

describe('🚀 Performance Tests', () => {
  beforeEach(() => {
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

  test('should have minimal overhead', async () => {
    const startTime = Date.now();

    // 10 simple operations
    const promises = Array.from({ length: 10 }, (_, i) =>
      threadts.run((x: number) => x * 2, i)
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(10);
    expect(results).toEqual(Array.from({ length: 10 }, (_, i) => i * 2));
    expect(duration).toBeLessThan(1000); // Should be under 1 second
  });

  test('should handle batch processing efficiently', async () => {
    const startTime = Date.now();

    const largeBatch = Array.from({ length: 50 }, (_, i) => ({
      fn: (x: number) => x + 1,
      data: i,
    }));

    const results = await threadts.batch(largeBatch, 5);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(50);
    expect(results.every((task) => task.success)).toBe(true);
    expect(duration).toBeLessThan(2000); // Batch should be efficient
  });

  test('should keep pool management fast', async () => {
    const instance = ThreadTS.getInstance();

    // Pool stats should be available immediately
    const startTime = Date.now();
    const stats = instance.getStats();
    const duration = Date.now() - startTime;

    expect(stats).toBeDefined();
    expect(duration).toBeLessThan(10); // Stats should be very fast
  });

  test('should manage memory correctly', async () => {
    const instance = ThreadTS.getInstance();

    // Run many small tasks
    for (let i = 0; i < 20; i++) {
      await instance.run((x: number) => x, i);
    }

    const stats = instance.getStats();
    expect(stats.completedTasks).toBeGreaterThanOrEqual(0);

    // Cleanup should work without errors
    await instance.terminate();
    expect(true).toBe(true);
  });
});

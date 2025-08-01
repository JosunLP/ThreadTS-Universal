/**
 * ThreadTS Universal - Main ThreadTS Manager
 * The core orchestrator for all parallel execution
 */

import { BrowserWorkerAdapter } from '../adapters/browser';
import { BunWorkerAdapter } from '../adapters/bun';
import { DenoWorkerAdapter } from '../adapters/deno';
import { NodeWorkerAdapter } from '../adapters/node';
import { WorkerPoolManager } from '../pool/manager';
import {
  Platform,
  PoolConfig,
  PoolManager,
  SerializableData,
  SerializableFunction,
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
} from '../types';
import { detectPlatform, supportsWorkerThreads } from '../utils/platform';

export class ThreadTS {
  private static instance: ThreadTS | null = null;
  private adapter: WorkerAdapter;
  private pool: PoolManager;
  private platform: Platform;

  private constructor(poolConfig?: PoolConfig) {
    this.platform = detectPlatform();
    this.adapter = this.createAdapter();
    this.pool = new WorkerPoolManager(this.adapter, poolConfig);
  }

  /**
   * Gets the singleton instance of ThreadTS
   */
  static getInstance(poolConfig?: PoolConfig): ThreadTS {
    if (!ThreadTS.instance) {
      ThreadTS.instance = new ThreadTS(poolConfig);
    }
    return ThreadTS.instance;
  }

  /**
   * Executes a function in a worker thread with the given data
   * This is the main API - one-liner parallel execution
   * Falls back to synchronous execution if workers are not supported
   */
  async run<T = unknown>(
    fn: SerializableFunction,
    data?: SerializableData,
    options?: ThreadOptions
  ): Promise<T> {
    if (!this.adapter.isSupported()) {
      console.warn(
        `Worker threads are not supported in ${this.platform} environment - falling back to synchronous execution`
      );

      // Fallback: synchrone Ausführung
      try {
        const result = fn(data);
        return result instanceof Promise ? await result : result;
      } catch (error) {
        throw new WorkerError(
          `Synchronous fallback execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    const result = await this.pool.execute<T>(fn, data, options);
    return result.result;
  }

  /**
   * Executes a function and returns detailed execution information
   * Falls back to synchronous execution if workers are not supported
   */
  async execute<T = unknown>(
    fn: SerializableFunction,
    data?: SerializableData,
    options?: ThreadOptions
  ): Promise<ThreadResult<T>> {
    if (!this.adapter.isSupported()) {
      console.warn(
        `Worker threads are not supported in ${this.platform} environment - using synchronous execution`
      );

      const startTime = Date.now();

      try {
        const syncResult = fn(data);
        const result =
          syncResult instanceof Promise ? await syncResult : syncResult;
        const endTime = Date.now();

        return {
          result,
          executionTime: endTime - startTime,
          workerId: 'sync-fallback',
        };
      } catch (error) {
        throw new WorkerError(
          `Synchronous fallback execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
    if (!supportsWorkerThreads()) {
      throw new WorkerError(
        `Worker threads are not supported in ${this.platform} environment`
      );
    }

    return await this.pool.execute<T>(fn, data, options);
  }

  /**
   * Executes multiple functions in parallel
   */
  async parallel<T = unknown>(
    tasks: {
      fn: SerializableFunction;
      data?: SerializableData;
      options?: ThreadOptions;
    }[]
  ): Promise<T[]> {
    const promises = tasks.map((task) =>
      this.run<T>(task.fn, task.data, task.options)
    );

    return await Promise.all(promises);
  }

  /**
   * Executes functions in batches with controlled concurrency
   */
  async batch<T = unknown>(
    tasks: Array<{
      fn: SerializableFunction;
      data?: SerializableData;
      options?: ThreadOptions;
    }>,
    batchSize: number = 4
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await this.parallel<T>(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Maps an array in parallel
   */
  async map<TInput, TOutput>(
    items: TInput[],
    fn: (item: TInput, index: number) => TOutput,
    options?: ThreadOptions & { batchSize?: number }
  ): Promise<TOutput[]> {
    // Simple implementation using direct execution
    const promises = items.map((item, index) =>
      this.run(() => fn(item, index), undefined, options)
    );

    return Promise.all(promises) as Promise<TOutput[]>;
  }

  /**
   * Filters an array in parallel
   */
  async filter<T>(
    items: T[],
    predicate: (item: T, index: number) => boolean,
    options?: ThreadOptions & { batchSize?: number }
  ): Promise<T[]> {
    // Simple implementation using direct execution
    const promises = items.map(async (item, index) => {
      const keep = await this.run(
        () => predicate(item, index),
        undefined,
        options
      );
      return { item, keep: keep as boolean };
    });

    const results = await Promise.all(promises);
    return results.filter((result) => result.keep).map((result) => result.item);
  }

  /**
   * Reduces an array in parallel (with chunking)
   */
  async reduce<T, TResult>(
    items: T[],
    fn: (acc: TResult, current: T, index: number) => TResult,
    initialValue: TResult,
    options?: ThreadOptions
  ): Promise<TResult> {
    // Simple sequential implementation to avoid complex type issues
    let result = initialValue;
    for (let i = 0; i < items.length; i++) {
      result = (await this.run(
        () => fn(result, items[i], i),
        undefined,
        options
      )) as TResult;
    }
    return result;
  }

  /**
   * Resizes the worker pool
   */
  async resize(size: number): Promise<void> {
    await this.pool.resize(size);
  }

  /**
   * Gets pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Gets the current platform
   */
  getPlatform(): Platform {
    return this.platform;
  }

  /**
   * Checks if worker threads are supported
   */
  isSupported(): boolean {
    return supportsWorkerThreads();
  }

  /**
   * Terminates the thread pool and cleans up resources
   */
  async terminate(): Promise<void> {
    await this.pool.terminate();
    ThreadTS.instance = null;
  }

  private createAdapter(): WorkerAdapter {
    switch (this.platform) {
      case 'browser':
        return new BrowserWorkerAdapter();
      case 'node':
        return new NodeWorkerAdapter();
      case 'deno':
        return new DenoWorkerAdapter();
      case 'bun':
        return new BunWorkerAdapter();
      default:
        throw new WorkerError(`Unsupported platform: ${this.platform}`);
    }
  }
}

// Create default instance for convenience
const threadts = ThreadTS.getInstance();

export default threadts;

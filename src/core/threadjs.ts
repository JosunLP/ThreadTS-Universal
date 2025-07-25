/**
 * ThreadJS Universal - Main ThreadJS Manager
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
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
} from '../types';
import { detectPlatform, supportsWorkerThreads } from '../utils/platform';

export class ThreadJS {
  private static instance: ThreadJS | null = null;
  private adapter: WorkerAdapter;
  private pool: PoolManager;
  private platform: Platform;

  private constructor(poolConfig?: PoolConfig) {
    this.platform = detectPlatform();
    this.adapter = this.createAdapter();
    this.pool = new WorkerPoolManager(this.adapter, poolConfig);
  }

  /**
   * Gets the singleton instance of ThreadJS
   */
  static getInstance(poolConfig?: PoolConfig): ThreadJS {
    if (!ThreadJS.instance) {
      ThreadJS.instance = new ThreadJS(poolConfig);
    }
    return ThreadJS.instance;
  }

  /**
   * Executes a function in a worker thread with the given data
   * This is the main API - one-liner parallel execution
   * Falls back to synchronous execution if workers are not supported
   */
  async run<T = any>(
    fn: Function,
    data?: any,
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

    const result = await this.pool.execute<T>(fn as any, data, options);
    return result.result;
  }

  /**
   * Executes a function and returns detailed execution information
   * Falls back to synchronous execution if workers are not supported
   */
  async execute<T = any>(
    fn: Function,
    data?: any,
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

    return await this.pool.execute<T>(fn as any, data, options);
  }

  /**
   * Executes multiple functions in parallel
   */
  async parallel<T = any>(
    tasks: Array<{
      fn: Function;
      data?: any;
      options?: ThreadOptions;
    }>
  ): Promise<T[]> {
    const promises = tasks.map((task) =>
      this.run<T>(task.fn, task.data, task.options)
    );

    return await Promise.all(promises);
  }

  /**
   * Executes functions in batches with controlled concurrency
   */
  async batch<T = any>(
    tasks: Array<{
      fn: Function;
      data?: any;
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
   * Maps an array of data through a function in parallel
   */
  async map<TInput, TOutput>(
    data: TInput[],
    fn: (item: TInput, index: number) => TOutput,
    options?: ThreadOptions & { batchSize?: number }
  ): Promise<TOutput[]> {
    const batchSize = options?.batchSize || 4;
    const tasks = data.map((item, index) => ({
      fn: (input: { item: TInput; index: number }) =>
        fn(input.item, input.index),
      data: { item, index },
      options,
    }));

    return await this.batch<TOutput>(tasks, batchSize);
  }

  /**
   * Filters an array in parallel
   */
  async filter<T>(
    data: T[],
    fn: (item: T, index: number) => boolean,
    options?: ThreadOptions & { batchSize?: number }
  ): Promise<T[]> {
    const batchSize = options?.batchSize || 4;
    const tasks = data.map((item, index) => ({
      fn: (input: { item: T; index: number }) => ({
        item: input.item,
        keep: fn(input.item, input.index),
      }),
      data: { item, index },
      options,
    }));

    const results = await this.batch<{ item: T; keep: boolean }>(
      tasks,
      batchSize
    );
    return results.filter((result) => result.keep).map((result) => result.item);
  }

  /**
   * Reduces an array in parallel (for associative operations)
   */
  async reduce<T, TResult>(
    data: T[],
    fn: (accumulator: TResult, current: T, index: number) => TResult,
    initialValue: TResult,
    options?: ThreadOptions
  ): Promise<TResult> {
    if (data.length === 0) return initialValue;
    if (data.length === 1) return fn(initialValue, data[0], 0);

    // Split data into chunks for parallel processing
    const chunkSize = Math.ceil(data.length / 4);
    const chunks: T[][] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    // Process chunks in parallel
    const chunkResults = await this.parallel<TResult>(
      chunks.map((chunk, chunkIndex) => ({
        fn: (input: {
          chunk: T[];
          initialValue: TResult;
          startIndex: number;
        }) => {
          return input.chunk.reduce(
            (acc, item, index) => fn(acc, item, input.startIndex + index),
            input.initialValue
          );
        },
        data: {
          chunk,
          initialValue: chunkIndex === 0 ? initialValue : (chunks[0][0] as any),
          startIndex: chunkIndex * chunkSize,
        },
        options,
      }))
    );

    // Combine chunk results
    return chunkResults.reduce((acc, result, index) =>
      index === 0 ? result : fn(acc, result as any, index)
    );
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
    ThreadJS.instance = null;
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
const threadjs = ThreadJS.getInstance();

export default threadjs;

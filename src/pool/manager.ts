/**
 * ThreadTS Universal - Worker Pool Manager
 * Manages a pool of workers for optimal performance
 */

import {
  PoolConfig,
  PoolManager,
  PoolStats,
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
  WorkerInstance,
} from '../types';
import { getOptimalWorkerCount } from '../utils/platform';

interface PoolTask<T = any> {
  id: string;
  fn: Function;
  data: any;
  options: ThreadOptions;
  resolve: (result: ThreadResult<T>) => void;
  reject: (error: Error) => void;
  priority: number;
  createdAt: number;
}

export class WorkerPoolManager implements PoolManager {
  private workers: WorkerInstance[] = [];
  private idleWorkers: WorkerInstance[] = [];
  private busyWorkers: Set<WorkerInstance> = new Set();
  private taskQueue: PoolTask[] = [];
  private completedTasks = 0;
  private totalExecutionTime = 0;
  private isTerminating = false;

  private readonly config: Required<PoolConfig>;

  constructor(
    private adapter: WorkerAdapter,
    config: PoolConfig = {}
  ) {
    const optimalWorkerCount = getOptimalWorkerCount();

    this.config = {
      minWorkers: config.minWorkers ?? 1,
      maxWorkers: config.maxWorkers ?? optimalWorkerCount,
      idleTimeout: config.idleTimeout ?? 30000, // 30 seconds
      queueSize: config.queueSize ?? 1000,
      strategy: config.strategy ?? 'least-busy',
    };

    // Initialize minimum workers
    this.initializeWorkers().catch(console.error);
  }

  async execute<T = any>(
    fn: Function,
    data: any,
    options: ThreadOptions = {}
  ): Promise<ThreadResult<T>> {
    if (this.isTerminating) {
      // Return a cancelled result instead of throwing
      return {
        result: undefined as T,
        executionTime: 0,
        error: new WorkerError('Pool is terminating'),
      };
    }

    return new Promise<ThreadResult<T>>((resolve, reject) => {
      const priority = this.getPriority(options.priority);
      const task: PoolTask<T> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fn,
        data,
        options,
        resolve,
        reject,
        priority,
        createdAt: Date.now(),
      };

      // Check queue size limit
      if (this.taskQueue.length >= this.config.queueSize) {
        reject(new WorkerError('Task queue is full'));
        return;
      }

      // Add to queue with priority sorting
      this.taskQueue.push(task);
      this.taskQueue.sort((a, b) => b.priority - a.priority);

      // Process queue
      this.processQueue().catch(reject);
    });
  }

  async resize(size: number): Promise<void> {
    if (size < this.config.minWorkers) {
      size = this.config.minWorkers;
    }

    if (size > this.config.maxWorkers) {
      size = this.config.maxWorkers;
    }

    const currentSize = this.workers.length;

    if (size > currentSize) {
      // Add workers
      const workersToAdd = size - currentSize;
      const newWorkers = await Promise.all(
        Array(workersToAdd)
          .fill(null)
          .map(() => this.adapter.createWorker(''))
      );

      this.workers.push(...newWorkers);
      this.idleWorkers.push(...newWorkers);
    } else if (size < currentSize) {
      // Remove workers
      const workersToRemove = currentSize - size;
      const workersToTerminate = this.idleWorkers.splice(0, workersToRemove);

      for (const worker of workersToTerminate) {
        await this.adapter.terminateWorker(worker);
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }
      }
    }
  }

  async terminate(): Promise<void> {
    this.isTerminating = true;

    // Gracefully handle queued tasks
    for (const task of this.taskQueue) {
      task.resolve({
        result: undefined as any,
        executionTime: 0,
        error: new WorkerError('Pool is terminating'),
      });
    }
    this.taskQueue = [];

    // Wait for busy workers to complete or timeout
    const busyWorkerPromises = Array.from(this.busyWorkers).map(
      (worker) =>
        new Promise<void>((resolve) => {
          // Give workers 5 seconds to complete
          const timeout = setTimeout(() => resolve(), 5000);

          // Check if worker becomes idle
          const checkIdle = setInterval(() => {
            if (worker.isIdle()) {
              clearTimeout(timeout);
              clearInterval(checkIdle);
              resolve();
            }
          }, 100);
        })
    );

    await Promise.all(busyWorkerPromises);

    // Terminate all workers
    await Promise.all(
      this.workers.map((worker) => this.adapter.terminateWorker(worker))
    );

    this.workers = [];
    this.idleWorkers = [];
    this.busyWorkers.clear();
  }

  getStats(): PoolStats {
    return {
      activeWorkers: this.busyWorkers.size,
      idleWorkers: this.idleWorkers.length,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.completedTasks,
      averageExecutionTime:
        this.completedTasks > 0
          ? this.totalExecutionTime / this.completedTasks
          : 0,
    };
  }

  private async initializeWorkers(): Promise<void> {
    const workers = await Promise.all(
      Array(this.config.minWorkers)
        .fill(null)
        .map(() => this.adapter.createWorker(''))
    );

    this.workers.push(...workers);
    this.idleWorkers.push(...workers);
  }

  private async processQueue(): Promise<void> {
    while (this.taskQueue.length > 0 && !this.isTerminating) {
      const worker = await this.getAvailableWorker();
      if (!worker) break;

      const task = this.taskQueue.shift();
      if (!task) break;

      // Execute task
      this.executeTask(worker, task).catch((error) => {
        task.reject(error);
        this.releaseWorker(worker);
      });
    }
  }

  private async getAvailableWorker(): Promise<WorkerInstance | null> {
    // Check for idle workers first
    if (this.idleWorkers.length > 0) {
      const worker = this.idleWorkers.shift()!;
      this.busyWorkers.add(worker);
      return worker;
    }

    // Create new worker if under max limit
    if (this.workers.length < this.config.maxWorkers) {
      try {
        const worker = await this.adapter.createWorker('');
        this.workers.push(worker);
        this.busyWorkers.add(worker);
        return worker;
      } catch (error) {
        console.error('Failed to create new worker:', error);
      }
    }

    // All workers are busy
    return null;
  }

  private async executeTask<T>(
    worker: WorkerInstance,
    task: PoolTask<T>
  ): Promise<void> {
    try {
      const result = await worker.execute<T>(
        task.fn as any,
        task.data,
        task.options
      );

      // Update statistics
      this.completedTasks++;
      this.totalExecutionTime += result.executionTime;

      task.resolve(result);
    } catch (error) {
      task.reject(error as Error);
    } finally {
      this.releaseWorker(worker);

      // Process next task if queue not empty
      if (this.taskQueue.length > 0) {
        this.processQueue().catch(console.error);
      }
    }
  }

  private releaseWorker(worker: WorkerInstance): void {
    this.busyWorkers.delete(worker);

    if (!this.isTerminating && worker.isIdle()) {
      this.idleWorkers.push(worker);

      // Set up idle timeout for cleanup
      setTimeout(() => {
        this.cleanupIdleWorker(worker);
      }, this.config.idleTimeout);
    } else if (!this.isTerminating) {
      // Worker might not be immediately idle, add back after a short delay
      setTimeout(() => {
        if (worker.isIdle() && !this.busyWorkers.has(worker)) {
          this.idleWorkers.push(worker);
        }
      }, 10); // 10ms delay
    }
  }

  private async cleanupIdleWorker(worker: WorkerInstance): Promise<void> {
    // Only cleanup if worker is still idle and we have more than minimum workers
    if (
      worker.isIdle() &&
      this.idleWorkers.includes(worker) &&
      this.workers.length > this.config.minWorkers
    ) {
      const idleIndex = this.idleWorkers.indexOf(worker);
      if (idleIndex !== -1) {
        this.idleWorkers.splice(idleIndex, 1);
      }

      const workerIndex = this.workers.indexOf(worker);
      if (workerIndex !== -1) {
        this.workers.splice(workerIndex, 1);
      }

      await this.adapter.terminateWorker(worker);
    }
  }

  private getPriority(priority?: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
      default:
        return 2;
    }
  }
}

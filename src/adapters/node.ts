/**
 * ThreadTS Universal - Node.js Worker Adapter
 */

import {
  SerializableFunction,
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
  WorkerInstance,
} from '../types';
import { getHighResTimestamp } from '../utils/platform';
import { createWorkerScript } from '../utils/serialization';

// Node.js Worker Threads API types
interface NodeWorkerOptions {
  eval?: boolean;
  transferList?: Transferable[];
  resourceLimits?: {
    maxOldGenerationSizeMb?: number;
    maxYoungGenerationSizeMb?: number;
    codeRangeSizeMb?: number;
    stackSizeMb?: number;
  };
  trackUnmanagedFds?: boolean;
  env?: Record<string, string>;
  argv?: string[];
  execArgv?: string[];
  stdin?: boolean;
  stdout?: boolean;
  stderr?: boolean;
}

interface NodeWorker {
  on(event: 'message', listener: (value: unknown) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (exitCode: number) => void): void;
  on(event: 'messageerror', listener: (error: Error) => void): void;
  on(event: 'online', listener: () => void): void;
  postMessage(value: unknown, transferList?: Transferable[]): void;
  terminate(): Promise<number>;
  threadId: number;
  resourceLimits?: {
    maxOldGenerationSizeMb: number;
    maxYoungGenerationSizeMb: number;
    codeRangeSizeMb: number;
    stackSizeMb: number;
  };
  getHeapSnapshot?(): Promise<ReadableStream>;
}

interface NodeWorkerThreads {
  Worker: new (
    filename: string | URL,
    options?: NodeWorkerOptions
  ) => NodeWorker;
  isMainThread: boolean;
  parentPort: MessagePort | null;
  threadId: number;
  workerData: unknown;
  MessageChannel: typeof MessageChannel;
  MessagePort: typeof MessagePort;
  moveMessagePortToContext?: (
    port: MessagePort,
    context: unknown
  ) => MessagePort;
  receiveMessageOnPort?: (
    port: MessagePort
  ) => { message: unknown } | undefined;
  markAsUntransferable?: (object: object) => void;
  getEnvironmentData?: (key: string) => unknown;
  setEnvironmentData?: (key: string, value: unknown) => void;
}

export class NodeWorkerAdapter implements WorkerAdapter {
  readonly platform = 'node' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new NodeWorkerInstance(script);
  }

  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  isSupported(): boolean {
    try {
      const nodeRequire = (
        globalThis as unknown as { require?: NodeJS.Require }
      ).require;
      if (nodeRequire) {
        nodeRequire('worker_threads');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

class NodeWorkerInstance implements WorkerInstance {
  readonly id: string;
  private worker: NodeWorker | null = null;
  private isTerminated = false;
  private isExecuting = false;
  private workerThreads: NodeWorkerThreads | null = null;

  constructor(private script: string) {
    this.id = `node-worker-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const nodeRequire = (
        globalThis as unknown as { require?: NodeJS.Require }
      ).require;
      if (nodeRequire) {
        this.workerThreads = nodeRequire('worker_threads') as NodeWorkerThreads;
      }
    } catch (error) {
      const cause = error instanceof Error ? error : undefined;
      throw new WorkerError(
        'Worker threads not available in this Node.js environment',
        cause
      );
    }
  }

  async execute<T = unknown>(
    fn: SerializableFunction,
    data: unknown,
    options: ThreadOptions = {}
  ): Promise<ThreadResult<T>> {
    if (this.isTerminated) {
      throw new WorkerError('Worker has been terminated');
    }

    if (this.isExecuting) {
      throw new WorkerError('Worker is already executing a task');
    }

    if (!this.workerThreads) {
      throw new WorkerError('Worker threads not available');
    }

    this.isExecuting = true;
    const startTime = getHighResTimestamp();

    try {
      // Create worker script
      const workerScript = createWorkerScript(fn, data, {
        timeout: options.timeout,
      });

      return await new Promise<ThreadResult<T>>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | undefined;
        let isResolved = false;

        // Enhanced worker options with resource limits and performance settings
        const workerOptions: NodeWorkerOptions = {
          eval: true,
          transferList: options.transferable || [],
          // Resource limits for better memory management
          resourceLimits: {
            maxOldGenerationSizeMb: 128, // Limit old generation heap
            maxYoungGenerationSizeMb: 64, // Limit young generation heap
            codeRangeSizeMb: 16, // Limit code range
            stackSizeMb: 4, // Limit stack size
          },
          // Track file descriptors for better resource management
          trackUnmanagedFds: true,
          // Isolated environment
          env: {},
          argv: [],
          execArgv: [],
          stdin: false,
          stdout: false,
          stderr: false,
        };

        // Create worker with enhanced options
        this.worker = new this.workerThreads!.Worker(
          workerScript,
          workerOptions
        );

        // Set up abort signal
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            if (!isResolved) {
              isResolved = true;
              this.cleanup(timeoutId);
              reject(new WorkerError('Operation was aborted'));
            }
          });
        }

        // Set up timeout
        if (options.timeout) {
          timeoutId = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              this.cleanup(timeoutId);
              reject(
                new WorkerError(
                  `Operation timed out after ${options.timeout}ms`
                )
              );
            }
          }, options.timeout);
        }

        // Handle worker messages with typed event
        this.worker.on('message', (event: unknown) => {
          if (isResolved) return;
          isResolved = true;

          const { result, error, executionTime } = event as {
            result: T;
            error?: string;
            executionTime?: number;
          };

          this.cleanup(timeoutId);

          if (error) {
            reject(new WorkerError(error));
          } else {
            resolve({
              result,
              executionTime: executionTime || getHighResTimestamp() - startTime,
              workerId: this.id,
            });
          }
        });

        // Handle worker errors
        this.worker.on('error', (error: Error) => {
          if (isResolved) return;
          isResolved = true;

          this.cleanup(timeoutId);
          reject(new WorkerError(`Worker error: ${error.message}`, error));
        });

        // Handle message errors (new Node.js feature)
        this.worker.on('messageerror', (error: Error) => {
          if (isResolved) return;
          isResolved = true;

          this.cleanup(timeoutId);
          reject(
            new WorkerError(
              `Message serialization error: ${error.message}`,
              error
            )
          );
        });

        // Handle worker exit
        this.worker.on('exit', (code: number) => {
          if (isResolved) return;
          if (code !== 0) {
            isResolved = true;
            this.cleanup(timeoutId);
            reject(new WorkerError(`Worker stopped with exit code ${code}`));
          }
        });

        // Log worker online event for debugging
        this.worker.on('online', () => {
          // Worker is ready to receive messages
        });

        // Send data to worker with proper transferable handling
        this.worker.postMessage(data, options.transferable);
      });
    } finally {
      this.isExecuting = false;
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.isTerminated = true;
  }

  isIdle(): boolean {
    return !this.isExecuting && !this.isTerminated;
  }

  private cleanup(timeoutId?: NodeJS.Timeout): void {
    if (this.worker) {
      this.worker.terminate().catch(() => {
        // Ignore termination errors
      });
      this.worker = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get heap snapshot for memory analysis (Node.js specific feature)
   */
  async getHeapSnapshot(): Promise<ReadableStream | null> {
    if (this.worker && this.worker.getHeapSnapshot) {
      return await this.worker.getHeapSnapshot();
    }
    return null;
  }

  /**
   * Get worker thread ID (Node.js specific feature)
   */
  getThreadId(): number | null {
    return this.worker?.threadId || null;
  }

  /**
   * Get resource limits (Node.js specific feature)
   */
  getResourceLimits(): NodeWorker['resourceLimits'] | null {
    return this.worker?.resourceLimits || null;
  }
}

/**
 * ThreadTS Universal - Bun Worker Adapter
 *
 * Implements worker support for Bun environments.
 * Uses Bun-specific optimizations like high-precision timing
 * and native garbage collection.
 *
 * @module adapters/bun
 * @author ThreadTS Universal Team
 */

import { WorkerInstance } from '../types';
import { AbstractWebWorkerInstance, AbstractWorkerAdapter } from './base';

/**
 * Bun worker options.
 */
interface BunWorkerOptions extends WorkerOptions {
  /** Credential handling for cross-origin requests */
  credentials?: 'omit' | 'same-origin' | 'include';
}

/**
 * Bun runtime namespace for type checking.
 *
 * Bun provides additional APIs for performance and system interaction.
 */
interface BunGlobal {
  Bun: {
    /** Bun version number */
    version: string;
    /** Bun git revision */
    revision: string;
    /** Environment variables */
    env: Record<string, string | undefined>;
    /** Path to the main module */
    main: string;
    /** Command-line arguments */
    argv: string[];
    /**
     * Finds a binary on the PATH.
     * @param binary - Binary name
     * @returns Full path or null
     */
    which(binary: string): string | null;
    /**
     * Executes a subprocess synchronously.
     */
    spawnSync(
      cmd: string[],
      options?: {
        cwd?: string;
        env?: Record<string, string>;
        stdin?: 'pipe' | 'inherit' | 'ignore';
        stdout?: 'pipe' | 'inherit' | 'ignore';
        stderr?: 'pipe' | 'inherit' | 'ignore';
      }
    ): {
      success: boolean;
      exitCode: number | null;
      signalCode: string | null;
      stdout: Buffer;
      stderr: Buffer;
    };
    /**
     * Triggers garbage collection.
     * @param force - Forces immediate collection
     */
    gc(force?: boolean): void;
    /**
     * Returns the current time in nanoseconds.
     * Higher precision than performance.now().
     */
    nanoseconds(): number;
    /**
     * Allocates unsafe memory without initialization.
     * @param size - Size in bytes
     */
    allocUnsafe(size: number): Uint8Array;
    /**
     * Writes data to a file descriptor.
     */
    write(fd: number, data: string | Uint8Array): number;
    /**
     * File system router for Next.js-style routing.
     */
    FileSystemRouter: new (options: { dir: string; style?: 'nextjs' }) => {
      match(pathname: string): { filePath: string; kind: string } | null;
    };
  };
}

/**
 * Worker adapter for Bun environments.
 *
 * Supports:
 * - High-performance workers with Bun optimizations
 * - Nanosecond-precision timing
 * - Native garbage collection
 * - Module workers with ES module syntax
 *
 * @extends AbstractWorkerAdapter
 *
 * @example
 * ```typescript
 * const adapter = new BunWorkerAdapter();
 * console.log(adapter.getBunVersion()); // "1.0.0"
 * console.log(adapter.nanoseconds()); // 1234567890123456
 * ```
 */
export class BunWorkerAdapter extends AbstractWorkerAdapter {
  readonly platform = 'bun' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new BunWorkerInstance(script);
  }

  isSupported(): boolean {
    return (
      typeof (globalThis as unknown as BunGlobal).Bun !== 'undefined' &&
      typeof Worker !== 'undefined'
    );
  }

  /**
   * Returns the Bun version number.
   *
   * @returns Bun version or null if not available
   *
   * @example
   * ```typescript
   * const version = adapter.getBunVersion();
   * console.log(version); // "1.0.0"
   * ```
   */
  getBunVersion(): string | null {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.version || null;
  }

  /**
   * Returns the Bun git revision.
   *
   * @returns Bun revision or null if not available
   */
  getBunRevision(): string | null {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.revision || null;
  }

  /**
   * Triggers garbage collection (Bun-specific feature).
   *
   * Useful for memory profiling or after memory-intensive operations.
   *
   * @param force - Forces immediate collection (default: false)
   *
   * @example
   * ```typescript
   * // After a large operation:
   * adapter.gc(true);
   * ```
   */
  gc(force = false): void {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    if (bun?.gc) {
      bun.gc(force);
    }
  }

  /**
   * Returns the current time in nanoseconds.
   *
   * Higher precision than performance.now() for performance measurements.
   *
   * @returns Time in nanoseconds
   *
   * @example
   * ```typescript
   * const start = adapter.nanoseconds();
   * // ... Operation ...
   * const duration = adapter.nanoseconds() - start;
   * console.log(`${duration / 1000000}ms`);
   * ```
   */
  nanoseconds(): number {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.nanoseconds() || Date.now() * 1000000;
  }
}

/**
 * Bun worker instance.
 *
 * Extends AbstractWebWorkerInstance with Bun-specific features:
 * - Nanosecond timing for precise performance measurements
 * - Native garbage collection support
 * - Optimized transferable-object handling
 *
 * @extends AbstractWebWorkerInstance
 */
class BunWorkerInstance extends AbstractWebWorkerInstance {
  /**
   * Creates a new Bun worker instance.
   *
   * @param _script - Initial script (overridden by execute())
   */
  constructor(_script: string) {
    super('bun', {
      workerName: undefined, // Auto-generated
      workerType: 'module', // Bun prefers module workers
    });
  }

  /**
   * Creates Bun-specific worker options.
   *
   * Configures:
   * - Module workers (ES module syntax)
   * - credentials: 'omit' for security
   *
   * @returns BunWorkerOptions
   */
  protected createPlatformWorkerOptions(): BunWorkerOptions {
    return {
      type: 'module',
      name: this.id,
      credentials: 'omit', // Security: do not include credentials
    };
  }

  /**
   * Returns Bun-specific worker information.
   *
   * @returns Object with worker ID, Bun version, and capabilities
   *
   * @example
   * ```typescript
   * const info = worker.getWorkerInfo();
   * console.log(info.capabilities); // ['transferable-objects', ...]
   * ```
   */
  getWorkerInfo(): {
    id: string;
    bunVersion: string | null;
    bunRevision: string | null;
    capabilities: string[];
  } {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return {
      id: this.id,
      bunVersion: bun?.version || null,
      bunRevision: bun?.revision || null,
      capabilities: [
        'transferable-objects',
        'blob-urls',
        'module-workers',
        'high-precision-timing',
        'garbage-collection',
      ],
    };
  }

  /**
   * Forces garbage collection for this worker.
   *
   * Uses Bun's native GC API for immediate memory reclamation.
   */
  forceGC(): void {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    if (bun?.gc) {
      bun.gc(true);
    }
  }

  /**
   * Returns high-precision time in nanoseconds.
   *
   * Uses Bun's nanoseconds() for maximum precision.
   *
   * @returns Time in nanoseconds
   */
  getHighPrecisionTime(): number {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.nanoseconds() || performance.now() * 1000000;
  }
}

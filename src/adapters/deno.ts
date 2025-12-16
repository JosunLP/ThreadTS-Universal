/**
 * ThreadTS Universal - Deno Worker Adapter
 *
 * Implements worker support for Deno environments.
 * Uses Deno-specific features like permission control and module workers.
 *
 * @module adapters/deno
 * @author ThreadTS Universal Team
 */

import { WorkerInstance } from '../types';
import { AbstractWebWorkerInstance, AbstractWorkerAdapter } from './base';

/**
 * Deno worker options with permission control.
 *
 * Enables fine-grained access control for workers.
 */
interface DenoWorkerOptions extends WorkerOptions {
  /** Deno-specific settings */
  deno?: {
    /** Permission configuration for the worker */
    permissions?: DenoWorkerPermissions;
    /** Whether the Deno namespace should be available inside the worker */
    namespace?: boolean;
  };
}

/**
 * Deno permission configuration.
 *
 * Each permission can be:
 * - `true`: full access
 * - `false`: no access
 * - `string[]`: access to specific resources
 */
interface DenoWorkerPermissions {
  /** Network access */
  net?: boolean | string[];
  /** File system read access */
  read?: boolean | string[];
  /** File system write access */
  write?: boolean | string[];
  /** Environment variables */
  env?: boolean | string[];
  /** Subprocess execution */
  run?: boolean | string[];
  /** Foreign Function Interface */
  ffi?: boolean | string[];
  /** High-Resolution Timer */
  hrtime?: boolean;
  /** System information */
  sys?: boolean | string[];
}

/**
 * Deno namespace interface for type checking.
 */
interface DenoNamespace {
  permissions: {
    query(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
    request(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
    revoke(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
  };
  version: {
    deno: string;
    v8: string;
    typescript: string;
  };
  build: {
    target: string;
    arch: string;
    os: string;
    vendor: string;
    env?: string;
  };
  env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  };
}

/**
 * Worker adapter for Deno environments.
 *
 * Supports:
 * - Module workers (ES module syntax)
 * - Fine-grained permission control
 * - Sandbox isolation
 *
 * @extends AbstractWorkerAdapter
 *
 * @example
 * ```typescript
 * const adapter = new DenoWorkerAdapter();
 * console.log(adapter.getDenoVersion()); // "1.40.0"
 * const worker = await adapter.createWorker('');
 * ```
 */
export class DenoWorkerAdapter extends AbstractWorkerAdapter {
  readonly platform = 'deno' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new DenoWorkerInstance(script);
  }

  isSupported(): boolean {
    return (
      typeof (globalThis as unknown as { Deno?: DenoNamespace }).Deno !==
        'undefined' && typeof Worker !== 'undefined'
    );
  }

  /**
   * Returns Deno version information.
   *
   * @returns Deno version or null if not available
   *
   * @example
   * ```typescript
   * const version = adapter.getDenoVersion();
   * console.log(version); // "1.40.0"
   * ```
   */
  getDenoVersion(): string | null {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    return deno?.version.deno || null;
  }

  /**
   * Checks whether a specific permission has been granted.
   *
   * @param name - Permission name (e.g. 'read', 'write', 'net')
   * @param descriptor - Optional permission descriptor for specific resources
   * @returns true if permission is granted
   *
   * @example
   * ```typescript
   * if (await adapter.checkPermission('read')) {
   *   // File system read is allowed
   * }
   * ```
   */
  async checkPermission(
    name: string,
    descriptor?: PermissionDescriptor
  ): Promise<boolean> {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    if (!deno) return false;

    try {
      const status = await deno.permissions.query(
        descriptor || ({ name } as PermissionDescriptor)
      );
      return status.state === 'granted';
    } catch {
      return false;
    }
  }
}

/**
 * Deno worker instance.
 *
 * Extends AbstractWebWorkerInstance with Deno-specific features:
 * - Permission isolation (minimal by default)
 * - Module worker support
 * - No Deno namespace inside the worker (sandbox)
 *
 * @extends AbstractWebWorkerInstance
 */
class DenoWorkerInstance extends AbstractWebWorkerInstance {
  /**
   * Creates a new Deno worker instance.
   *
   * @param _script - Initial script (overridden by execute())
   */
  constructor(_script: string) {
    super('deno', {
      workerName: undefined, // Auto-generated
      workerType: 'module', // Deno prefers module workers
    });
  }

  /**
   * Creates Deno-specific worker options.
   *
   * Configures minimal permissions for maximum security:
   * - Only hrtime is allowed for performance measurement
   * - No network, file system, or subprocess access
   * - Deno namespace is not exposed (sandbox)
   *
   * @returns DenoWorkerOptions with permission configuration
   */
  protected createPlatformWorkerOptions(): DenoWorkerOptions {
    return {
      type: 'module',
      name: this.id,
      deno: {
        permissions: {
          // Minimal permissions for security
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          hrtime: true, // For performance monitoring
          sys: false,
        },
        namespace: false, // Do not expose the Deno namespace in the worker
      },
    };
  }

  /**
   * Returns Deno-specific worker information.
   *
   * @returns Object with worker ID, Deno version, and active permissions
   *
   * @example
   * ```typescript
   * const info = worker.getWorkerInfo();
   * console.log(info.denoVersion); // "1.40.0"
   * console.log(info.permissions); // ["hrtime"]
   * ```
   */
  getWorkerInfo(): {
    id: string;
    denoVersion: string | null;
    permissions: string[];
  } {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    return {
      id: this.id,
      denoVersion: deno?.version.deno || null,
      permissions: ['hrtime'], // Currently granted permissions
    };
  }

  /**
   * Checks whether the Deno API is available in the worker context.
   *
   * @returns true if the Deno namespace is available
   */
  hasDenoAPI(): boolean {
    return (
      typeof (globalThis as unknown as { Deno?: DenoNamespace }).Deno !==
      'undefined'
    );
  }
}

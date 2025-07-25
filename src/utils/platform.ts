/**
 * ThreadTS Universal - Platform Detection Utilities
 */

import { Platform } from '../types';

/**
 * Detects the current JavaScript runtime platform
 */
export function detectPlatform(): Platform {
  // Browser detection
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'browser';
  }

  // Node.js detection
  if (
    typeof (globalThis as any).process !== 'undefined' &&
    (globalThis as any).process.versions &&
    (globalThis as any).process.versions.node
  ) {
    return 'node';
  }

  // Deno detection
  if (typeof (globalThis as any).Deno !== 'undefined') {
    return 'deno';
  }

  // Bun detection
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return 'bun';
  }

  return 'unknown';
}

/**
 * Checks if Worker Threads are supported in the current environment
 */
export function supportsWorkerThreads(): boolean {
  const platform = detectPlatform();

  switch (platform) {
    case 'browser':
      return typeof Worker !== 'undefined';
    case 'node':
      try {
        // Dynamic import for Node.js worker_threads
        const nodeRequire = (globalThis as any).require;
        if (nodeRequire) {
          nodeRequire('worker_threads');
          return true;
        }
        return false;
      } catch {
        return false;
      }
    case 'deno':
      return typeof Worker !== 'undefined';
    case 'bun':
      return typeof Worker !== 'undefined';
    default:
      return false;
  }
}

/**
 * Checks if Transferable Objects are supported
 */
export function supportsTransferableObjects(): boolean {
  const platform = detectPlatform();

  switch (platform) {
    case 'browser':
      return (
        typeof ArrayBuffer !== 'undefined' &&
        typeof MessageChannel !== 'undefined'
      );
    case 'node':
      return true; // Node.js supports transferable objects in worker_threads
    case 'deno':
      return typeof ArrayBuffer !== 'undefined';
    case 'bun':
      return typeof ArrayBuffer !== 'undefined';
    default:
      return false;
  }
}

/**
 * Gets the optimal number of workers for the current platform
 */
export function getOptimalWorkerCount(): number {
  const platform = detectPlatform();

  switch (platform) {
    case 'browser':
      return (globalThis as any).navigator?.hardwareConcurrency || 4;
    case 'node':
      try {
        const nodeRequire = (globalThis as any).require;
        if (nodeRequire) {
          const os = nodeRequire('os');
          return os.cpus().length;
        }
        return 4;
      } catch {
        return 4;
      }
    case 'deno':
      return (globalThis as any).navigator?.hardwareConcurrency || 4;
    case 'bun':
      return (globalThis as any).navigator?.hardwareConcurrency || 4;
    default:
      return 4;
  }
}

/**
 * Checks if the current environment supports OffscreenCanvas
 */
export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

/**
 * Checks if the current environment supports Web Locks API
 */
export function supportsWebLocks(): boolean {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}

/**
 * Gets platform-specific performance timestamp
 */
export function getHighResTimestamp(): number {
  const platform = detectPlatform();

  switch (platform) {
    case 'browser':
      return performance.now();
    case 'node':
      try {
        const nodeRequire = (globalThis as any).require;
        if (nodeRequire) {
          const { performance: nodePerf } = nodeRequire('perf_hooks');
          return nodePerf.now();
        }
        return Date.now();
      } catch {
        return Date.now();
      }
    case 'deno':
      return performance.now();
    case 'bun':
      return performance.now();
    default:
      return Date.now();
  }
}

/**
 * Platform-specific memory usage information
 */
export interface MemoryInfo {
  used: number;
  total: number;
  available: number;
}

/**
 * Gets memory information for the current platform
 */
export function getMemoryInfo(): MemoryInfo | null {
  const platform = detectPlatform();

  switch (platform) {
    case 'browser':
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const mem = (performance as any).memory;
        return {
          used: mem.usedJSHeapSize,
          total: mem.totalJSHeapSize,
          available: mem.jsHeapSizeLimit - mem.usedJSHeapSize,
        };
      }
      return null;
    case 'node':
      try {
        const nodeProcess = (globalThis as any).process;
        if (nodeProcess && nodeProcess.memoryUsage) {
          const mem = nodeProcess.memoryUsage();
          return {
            used: mem.heapUsed,
            total: mem.heapTotal,
            available: mem.heapTotal - mem.heapUsed,
          };
        }
        return null;
      } catch {
        return null;
      }
    case 'deno':
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const mem = (performance as any).memory;
        return {
          used: mem.usedJSHeapSize,
          total: mem.totalJSHeapSize,
          available: mem.jsHeapSizeLimit - mem.usedJSHeapSize,
        };
      }
      return null;
    default:
      return null;
  }
}

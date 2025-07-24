"use strict";
/**
 * ThreadJS Universal - Platform Detection Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemoryInfo = exports.getHighResTimestamp = exports.supportsWebLocks = exports.supportsOffscreenCanvas = exports.getOptimalWorkerCount = exports.supportsTransferableObjects = exports.supportsWorkerThreads = exports.detectPlatform = void 0;
/**
 * Detects the current JavaScript runtime platform
 */
function detectPlatform() {
    // Browser detection
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        return 'browser';
    }
    // Node.js detection
    if (typeof globalThis.process !== 'undefined' &&
        globalThis.process.versions &&
        globalThis.process.versions.node) {
        return 'node';
    }
    // Deno detection
    if (typeof globalThis.Deno !== 'undefined') {
        return 'deno';
    }
    // Bun detection
    if (typeof globalThis.Bun !== 'undefined') {
        return 'bun';
    }
    return 'unknown';
}
exports.detectPlatform = detectPlatform;
/**
 * Checks if Worker Threads are supported in the current environment
 */
function supportsWorkerThreads() {
    const platform = detectPlatform();
    switch (platform) {
        case 'browser':
            return typeof Worker !== 'undefined';
        case 'node':
            try {
                // Dynamic import for Node.js worker_threads
                const nodeRequire = globalThis.require;
                if (nodeRequire) {
                    nodeRequire('worker_threads');
                    return true;
                }
                return false;
            }
            catch {
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
exports.supportsWorkerThreads = supportsWorkerThreads;
/**
 * Checks if Transferable Objects are supported
 */
function supportsTransferableObjects() {
    const platform = detectPlatform();
    switch (platform) {
        case 'browser':
            return (typeof ArrayBuffer !== 'undefined' &&
                typeof MessageChannel !== 'undefined');
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
exports.supportsTransferableObjects = supportsTransferableObjects;
/**
 * Gets the optimal number of workers for the current platform
 */
function getOptimalWorkerCount() {
    const platform = detectPlatform();
    switch (platform) {
        case 'browser':
            return globalThis.navigator?.hardwareConcurrency || 4;
        case 'node':
            try {
                const nodeRequire = globalThis.require;
                if (nodeRequire) {
                    const os = nodeRequire('os');
                    return os.cpus().length;
                }
                return 4;
            }
            catch {
                return 4;
            }
        case 'deno':
            return globalThis.navigator?.hardwareConcurrency || 4;
        case 'bun':
            return globalThis.navigator?.hardwareConcurrency || 4;
        default:
            return 4;
    }
}
exports.getOptimalWorkerCount = getOptimalWorkerCount;
/**
 * Checks if the current environment supports OffscreenCanvas
 */
function supportsOffscreenCanvas() {
    return typeof OffscreenCanvas !== 'undefined';
}
exports.supportsOffscreenCanvas = supportsOffscreenCanvas;
/**
 * Checks if the current environment supports Web Locks API
 */
function supportsWebLocks() {
    return typeof navigator !== 'undefined' && 'locks' in navigator;
}
exports.supportsWebLocks = supportsWebLocks;
/**
 * Gets platform-specific performance timestamp
 */
function getHighResTimestamp() {
    const platform = detectPlatform();
    switch (platform) {
        case 'browser':
            return performance.now();
        case 'node':
            try {
                const nodeRequire = globalThis.require;
                if (nodeRequire) {
                    const { performance: nodePerf } = nodeRequire('perf_hooks');
                    return nodePerf.now();
                }
                return Date.now();
            }
            catch {
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
exports.getHighResTimestamp = getHighResTimestamp;
/**
 * Gets memory information for the current platform
 */
function getMemoryInfo() {
    const platform = detectPlatform();
    switch (platform) {
        case 'browser':
            if (typeof performance !== 'undefined' && 'memory' in performance) {
                const mem = performance.memory;
                return {
                    used: mem.usedJSHeapSize,
                    total: mem.totalJSHeapSize,
                    available: mem.jsHeapSizeLimit - mem.usedJSHeapSize,
                };
            }
            return null;
        case 'node':
            try {
                const nodeProcess = globalThis.process;
                if (nodeProcess && nodeProcess.memoryUsage) {
                    const mem = nodeProcess.memoryUsage();
                    return {
                        used: mem.heapUsed,
                        total: mem.heapTotal,
                        available: mem.heapTotal - mem.heapUsed,
                    };
                }
                return null;
            }
            catch {
                return null;
            }
        case 'deno':
            if (typeof performance !== 'undefined' && 'memory' in performance) {
                const mem = performance.memory;
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
exports.getMemoryInfo = getMemoryInfo;

"use strict";
/**
 * ThreadJS Universal - Browser Worker Adapter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserWorkerAdapter = void 0;
const types_1 = require("../types");
const platform_1 = require("../utils/platform");
const serialization_1 = require("../utils/serialization");
class BrowserWorkerAdapter {
    constructor() {
        this.platform = 'browser';
    }
    async createWorker(script) {
        return new BrowserWorkerInstance(script);
    }
    async terminateWorker(worker) {
        await worker.terminate();
    }
    isSupported() {
        return (typeof Worker !== 'undefined' &&
            typeof Blob !== 'undefined' &&
            typeof URL !== 'undefined');
    }
}
exports.BrowserWorkerAdapter = BrowserWorkerAdapter;
class BrowserWorkerInstance {
    constructor(script) {
        this.script = script;
        this.worker = null;
        this.isTerminated = false;
        this.isExecuting = false;
        this.id = `browser-worker-${Math.random().toString(36).substr(2, 9)}`;
    }
    async execute(fn, data, options = {}) {
        if (this.isTerminated) {
            throw new types_1.WorkerError('Worker has been terminated');
        }
        if (this.isExecuting) {
            throw new types_1.WorkerError('Worker is already executing a task');
        }
        this.isExecuting = true;
        const startTime = (0, platform_1.getHighResTimestamp)();
        try {
            // Create worker script
            const workerScript = (0, serialization_1.createWorkerScript)(fn, data, {
                timeout: options.timeout,
            });
            // Create blob URL for worker
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            return await new Promise((resolve, reject) => {
                let timeoutId;
                let isResolved = false;
                // Create worker
                this.worker = new Worker(workerUrl);
                // Set up abort signal
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        if (!isResolved) {
                            isResolved = true;
                            this.cleanup(workerUrl, timeoutId);
                            reject(new types_1.WorkerError('Operation was aborted'));
                        }
                    });
                }
                // Set up timeout
                if (options.timeout) {
                    timeoutId = window.setTimeout(() => {
                        if (!isResolved) {
                            isResolved = true;
                            this.cleanup(workerUrl, timeoutId);
                            reject(new types_1.WorkerError(`Operation timed out after ${options.timeout}ms`));
                        }
                    }, options.timeout);
                }
                // Handle worker messages
                this.worker.onmessage = (event) => {
                    if (isResolved)
                        return;
                    isResolved = true;
                    const { result, error, executionTime } = event.data;
                    this.cleanup(workerUrl, timeoutId);
                    if (error) {
                        reject(new types_1.WorkerError(error));
                    }
                    else {
                        resolve({
                            result,
                            executionTime: executionTime || (0, platform_1.getHighResTimestamp)() - startTime,
                            workerId: this.id,
                        });
                    }
                };
                // Handle worker errors
                this.worker.onerror = (event) => {
                    if (isResolved)
                        return;
                    isResolved = true;
                    this.cleanup(workerUrl, timeoutId);
                    reject(new types_1.WorkerError(`Worker error: ${event.message}`));
                };
                // Transfer data if transferable objects are present
                if (options.transferable && options.transferable.length > 0) {
                    this.worker.postMessage(data, options.transferable);
                }
                else {
                    this.worker.postMessage(data);
                }
            });
        }
        finally {
            this.isExecuting = false;
        }
    }
    async terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.isTerminated = true;
    }
    isIdle() {
        return !this.isExecuting && !this.isTerminated;
    }
    cleanup(workerUrl, timeoutId) {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        URL.revokeObjectURL(workerUrl);
    }
}

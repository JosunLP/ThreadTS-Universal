"use strict";
/**
 * ThreadJS Universal - Node.js Worker Adapter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeWorkerAdapter = void 0;
const types_1 = require("../types");
const platform_1 = require("../utils/platform");
const serialization_1 = require("../utils/serialization");
class NodeWorkerAdapter {
    constructor() {
        this.platform = 'node';
    }
    async createWorker(script) {
        return new NodeWorkerInstance(script);
    }
    async terminateWorker(worker) {
        await worker.terminate();
    }
    isSupported() {
        try {
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
    }
}
exports.NodeWorkerAdapter = NodeWorkerAdapter;
class NodeWorkerInstance {
    constructor(script) {
        this.script = script;
        this.worker = null;
        this.isTerminated = false;
        this.isExecuting = false;
        this.workerThreads = null;
        this.id = `node-worker-${Math.random().toString(36).substr(2, 9)}`;
        try {
            const nodeRequire = globalThis.require;
            if (nodeRequire) {
                this.workerThreads = nodeRequire('worker_threads');
            }
        }
        catch (error) {
            throw new types_1.WorkerError('Worker threads not available in this Node.js environment');
        }
    }
    async execute(fn, data, options = {}) {
        if (this.isTerminated) {
            throw new types_1.WorkerError('Worker has been terminated');
        }
        if (this.isExecuting) {
            throw new types_1.WorkerError('Worker is already executing a task');
        }
        if (!this.workerThreads) {
            throw new types_1.WorkerError('Worker threads not available');
        }
        this.isExecuting = true;
        const startTime = (0, platform_1.getHighResTimestamp)();
        try {
            // Create worker script
            const workerScript = (0, serialization_1.createWorkerScript)(fn, data, {
                timeout: options.timeout,
            });
            return await new Promise((resolve, reject) => {
                let timeoutId;
                let isResolved = false;
                // Create worker
                this.worker = new this.workerThreads.Worker(workerScript, {
                    eval: true,
                    transferList: options.transferable || [],
                });
                // Set up abort signal
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        if (!isResolved) {
                            isResolved = true;
                            this.cleanup(timeoutId);
                            reject(new types_1.WorkerError('Operation was aborted'));
                        }
                    });
                }
                // Set up timeout
                if (options.timeout) {
                    timeoutId = setTimeout(() => {
                        if (!isResolved) {
                            isResolved = true;
                            this.cleanup(timeoutId);
                            reject(new types_1.WorkerError(`Operation timed out after ${options.timeout}ms`));
                        }
                    }, options.timeout);
                }
                // Handle worker messages
                this.worker.on('message', (event) => {
                    if (isResolved)
                        return;
                    isResolved = true;
                    const { result, error, executionTime } = event;
                    this.cleanup(timeoutId);
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
                });
                // Handle worker errors
                this.worker.on('error', (error) => {
                    if (isResolved)
                        return;
                    isResolved = true;
                    this.cleanup(timeoutId);
                    reject(new types_1.WorkerError(`Worker error: ${error.message}`, error));
                });
                // Handle worker exit
                this.worker.on('exit', (code) => {
                    if (isResolved)
                        return;
                    if (code !== 0) {
                        isResolved = true;
                        this.cleanup(timeoutId);
                        reject(new types_1.WorkerError(`Worker stopped with exit code ${code}`));
                    }
                });
                // Send data to worker
                this.worker.postMessage(data, options.transferable);
            });
        }
        finally {
            this.isExecuting = false;
        }
    }
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
        this.isTerminated = true;
    }
    isIdle() {
        return !this.isExecuting && !this.isTerminated;
    }
    cleanup(timeoutId) {
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
}

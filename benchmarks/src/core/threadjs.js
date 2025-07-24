"use strict";
/**
 * ThreadJS Universal - Main ThreadJS Manager
 * The core orchestrator for all parallel execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadJS = void 0;
const browser_1 = require("../adapters/browser");
const bun_1 = require("../adapters/bun");
const deno_1 = require("../adapters/deno");
const node_1 = require("../adapters/node");
const manager_1 = require("../pool/manager");
const types_1 = require("../types");
const platform_1 = require("../utils/platform");
class ThreadJS {
    constructor(poolConfig) {
        this.platform = (0, platform_1.detectPlatform)();
        this.adapter = this.createAdapter();
        this.pool = new manager_1.WorkerPoolManager(this.adapter, poolConfig);
    }
    /**
     * Gets the singleton instance of ThreadJS
     */
    static getInstance(poolConfig) {
        if (!ThreadJS.instance) {
            ThreadJS.instance = new ThreadJS(poolConfig);
        }
        return ThreadJS.instance;
    }
    /**
     * Executes a function in a worker thread with the given data
     * This is the main API - one-liner parallel execution
     */
    async run(fn, data, options) {
        if (!(0, platform_1.supportsWorkerThreads)()) {
            throw new types_1.WorkerError(`Worker threads are not supported in ${this.platform} environment`);
        }
        const result = await this.pool.execute(fn, data, options);
        return result.result;
    }
    /**
     * Executes a function and returns detailed execution information
     */
    async execute(fn, data, options) {
        if (!(0, platform_1.supportsWorkerThreads)()) {
            throw new types_1.WorkerError(`Worker threads are not supported in ${this.platform} environment`);
        }
        return await this.pool.execute(fn, data, options);
    }
    /**
     * Executes multiple functions in parallel
     */
    async parallel(tasks) {
        const promises = tasks.map((task) => this.run(task.fn, task.data, task.options));
        return await Promise.all(promises);
    }
    /**
     * Executes functions in batches with controlled concurrency
     */
    async batch(tasks, batchSize = 4) {
        const results = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            const batchResults = await this.parallel(batch);
            results.push(...batchResults);
        }
        return results;
    }
    /**
     * Maps an array of data through a function in parallel
     */
    async map(data, fn, options) {
        const batchSize = options?.batchSize || 4;
        const tasks = data.map((item, index) => ({
            fn: (input) => fn(input.item, input.index),
            data: { item, index },
            options,
        }));
        return await this.batch(tasks, batchSize);
    }
    /**
     * Filters an array in parallel
     */
    async filter(data, fn, options) {
        const batchSize = options?.batchSize || 4;
        const tasks = data.map((item, index) => ({
            fn: (input) => ({
                item: input.item,
                keep: fn(input.item, input.index),
            }),
            data: { item, index },
            options,
        }));
        const results = await this.batch(tasks, batchSize);
        return results.filter((result) => result.keep).map((result) => result.item);
    }
    /**
     * Reduces an array in parallel (for associative operations)
     */
    async reduce(data, fn, initialValue, options) {
        if (data.length === 0)
            return initialValue;
        if (data.length === 1)
            return fn(initialValue, data[0], 0);
        // Split data into chunks for parallel processing
        const chunkSize = Math.ceil(data.length / 4);
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        // Process chunks in parallel
        const chunkResults = await this.parallel(chunks.map((chunk, chunkIndex) => ({
            fn: (input) => {
                return input.chunk.reduce((acc, item, index) => fn(acc, item, input.startIndex + index), input.initialValue);
            },
            data: {
                chunk,
                initialValue: chunkIndex === 0 ? initialValue : chunks[0][0],
                startIndex: chunkIndex * chunkSize,
            },
            options,
        })));
        // Combine chunk results
        return chunkResults.reduce((acc, result, index) => index === 0 ? result : fn(acc, result, index));
    }
    /**
     * Resizes the worker pool
     */
    async resize(size) {
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
    getPlatform() {
        return this.platform;
    }
    /**
     * Checks if worker threads are supported
     */
    isSupported() {
        return (0, platform_1.supportsWorkerThreads)();
    }
    /**
     * Terminates the thread pool and cleans up resources
     */
    async terminate() {
        await this.pool.terminate();
        ThreadJS.instance = null;
    }
    createAdapter() {
        switch (this.platform) {
            case 'browser':
                return new browser_1.BrowserWorkerAdapter();
            case 'node':
                return new node_1.NodeWorkerAdapter();
            case 'deno':
                return new deno_1.DenoWorkerAdapter();
            case 'bun':
                return new bun_1.BunWorkerAdapter();
            default:
                throw new types_1.WorkerError(`Unsupported platform: ${this.platform}`);
        }
    }
}
exports.ThreadJS = ThreadJS;
ThreadJS.instance = null;
// Create default instance for convenience
const threadjs = ThreadJS.getInstance();
exports.default = threadjs;

"use strict";
/**
 * ThreadJS Universal - Core Types
 * Universal TypeScript library for effortless parallel computing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerializationError = exports.WorkerError = exports.TimeoutError = exports.ThreadError = void 0;
// Error types
class ThreadError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'ThreadError';
    }
}
exports.ThreadError = ThreadError;
class TimeoutError extends ThreadError {
    constructor(timeout) {
        super(`Operation timed out after ${timeout}ms`, 'TIMEOUT');
    }
}
exports.TimeoutError = TimeoutError;
class WorkerError extends ThreadError {
    constructor(message, cause) {
        super(message, 'WORKER_ERROR', cause);
    }
}
exports.WorkerError = WorkerError;
class SerializationError extends ThreadError {
    constructor(message, cause) {
        super(message, 'SERIALIZATION_ERROR', cause);
    }
}
exports.SerializationError = SerializationError;

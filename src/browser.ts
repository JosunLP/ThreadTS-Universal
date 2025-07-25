/**
 * ThreadTS Universal - Browser-specific exports
 */

export { BrowserWorkerAdapter } from './adapters/browser';
export * from './index';
export { threadts as default } from './index';

// Browser-specific utilities
export { supportsOffscreenCanvas, supportsWebLocks } from './utils/platform';

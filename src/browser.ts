/**
 * ThreadJS Universal - Browser-specific exports
 */

export { BrowserWorkerAdapter } from './adapters/browser';
export * from './index';
export { threadjs as default } from './index';

// Browser-specific utilities
export { supportsOffscreenCanvas, supportsWebLocks } from './utils/platform';

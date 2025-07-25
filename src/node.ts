/**
 * ThreadTS Universal - Node.js-specific exports
 */

export { NodeWorkerAdapter } from './adapters/node';
export * from './index';
export { threadts as default } from './index';

// Node.js-specific utilities can be added here
// For example: cluster management, process monitoring, etc.

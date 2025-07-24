/**
 * ThreadJS Universal - Live Demo (TypeScript)
 */
import { ThreadJS } from '../src/core/threadjs';

const threadjs = ThreadJS.getInstance();

async function runDemo() {
  console.log('🌟 ThreadJS Universal Live Demo (TS)\n');
  console.log('Platform:', threadjs.getPlatform());
  console.log('Worker Support:', threadjs.isSupported());

  // Basic Parallel Execution
  const result = await threadjs.run((x: number) => x * x, 12);
  console.log('Basic Parallel Execution:', result);
}

runDemo().catch(console.error);

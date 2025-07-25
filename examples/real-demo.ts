/**
 * ThreadTS Universal - Live Demo (TypeScript)
 */
import { ThreadTS } from '../src/core/threadjs';

const threadjs = ThreadTS.getInstance();

async function runDemo() {
  console.log('🌟 ThreadTS Universal Live Demo (TS)\n');
  console.log('Platform:', threadjs.getPlatform());
  console.log('Worker Support:', threadjs.isSupported());

  // Basic Parallel Execution
  const result = await threadjs.run((x: number) => x * x, 12);
  console.log('Basic Parallel Execution:', result);
}

runDemo().catch(console.error);

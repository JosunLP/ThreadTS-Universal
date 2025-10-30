/**
 * ThreadTS Universal - Live Demo (TypeScript)
 */
import { ThreadTS } from '../src/core/threadts';

const threadts = ThreadTS.getInstance();

async function runDemo() {
  console.log('🌟 ThreadTS Universal Live Demo (TS)\n');
  console.log('Platform:', threadts.getPlatform());
  console.log('Worker Support:', threadts.isSupported());

  // Basic Parallel Execution
  const result = await threadts.run((x: number) => x * x, 12);
  console.log('Basic Parallel Execution:', result);
}

runDemo().catch(console.error);

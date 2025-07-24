/**
 * ThreadJS Universal - Performance Benchmarks (TypeScript)
 */
import { ThreadJS } from '../src/core/threadjs';

const threadjs = ThreadJS.getInstance();

async function main() {
  console.log('🚀 ThreadJS Universal - Performance Benchmarks (TS)');
  console.log('Platform:', threadjs.getPlatform());
  console.log('Worker Support:', threadjs.isSupported());

  // Beispiel: Parallele Ausführung
  const result = await threadjs.run((x: number) => x * x, 42);
  console.log('Result:', result);
}

main().catch(console.error);

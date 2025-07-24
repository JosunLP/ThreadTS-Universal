/**
 * ThreadJS Universal - Advanced Performance Benchmarks (TypeScript)
 */
import { ThreadJS } from '../src/core/threadjs';

const threadjs = ThreadJS.getInstance();

async function runAdvancedBenchmarks() {
  console.log('🔬 ThreadJS Universal - Advanced Performance Analysis (TS)');
  console.log('Platform:', threadjs.getPlatform());
  console.log('Worker Support:', threadjs.isSupported());

  // Beispiel: Parallele Map
  const arr = Array.from({ length: 1000 }, (_, i) => i);
  const mapped = await threadjs.map(arr, (x) => x * 2);
  console.log('Mapped:', mapped.slice(0, 10));
}

runAdvancedBenchmarks().catch(console.error);

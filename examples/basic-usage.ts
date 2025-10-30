/**
 * ThreadTS Universal - Example Usage
 */

import threadts, { parallelMap, parallelMethod } from '../src';

// Example 1: Basic parallel execution
async function basicExample() {
  console.log('🚀 Basic Parallel Execution');

  // Basic parallel execution
  const result = await threadts.run((x: number) => x * x, 10);
  console.log('Square of 10:', result); // 100

  const complexResult = await threadts.run(
    (data: { numbers: number[] }) => {
      return data.numbers.reduce((sum, num) => sum + num * num, 0);
    },
    { numbers: [1, 2, 3, 4, 5] }
  );
  console.log('Sum of squares:', complexResult); // 55
}

// Example 2: Parallel array operations
async function arrayOperationsExample() {
  console.log('🔢 Parallel Array Operations');

  const numbers = Array.from({ length: 10 }, (_, i) => i + 1);

  // Parallel map
  const squares = await threadts.map(numbers, (x) => x * x);
  console.log('Squares:', squares);

  // Parallel filter
  const evens = await threadts.filter(numbers, (x) => x % 2 === 0);
  console.log('Even numbers:', evens);

  // Parallel reduce
  const sum = await threadts.reduce(numbers, (a, b) => a + b, 0);
  console.log('Sum:', sum);
}

// Example 3: Batch processing
async function batchProcessingExample() {
  console.log('📦 Batch Processing');

  const largeDataset = Array.from({ length: 100 }, (_, i) => i + 1);

  const results = await threadts.batch(
    largeDataset.map((item) => ({
      fn: (x: number) => {
        // Simulate heavy computation
        let result = x;
        for (let i = 0; i < 1000; i++) {
          result = Math.sin(result) + Math.cos(result);
        }
        return result;
      },
      data: item,
    })),
    4 // Process in batches of 4
  );

  console.log('Processed', results.length, 'items');
}

// Example 4: Using decorators
class DataProcessor {
  @parallelMethod({ timeout: 5000 })
  async heavyComputation(data: number[]): Promise<number> {
    return data.reduce((sum, num) => {
      // Simulate heavy computation
      let result = num;
      for (let i = 0; i < 10000; i++) {
        result = Math.sqrt(result + i);
      }
      return sum + result;
    }, 0);
  }

  @parallelMap({ batchSize: 3 })
  async processItems(items: string[]): Promise<string[]> {
    return items.map((item) => item.toUpperCase().split('').reverse().join(''));
  }
}

async function decoratorExample() {
  console.log('🎭 Decorator Example');

  const processor = new DataProcessor();

  const heavyResult = await processor.heavyComputation([1, 2, 3, 4, 5]);
  console.log('Heavy computation result:', heavyResult);

  const processedItems = await processor.processItems([
    'hello',
    'world',
    'threadts',
  ]);
  console.log('Processed items:', processedItems);
}

// Example 5: Performance comparison
async function performanceComparison() {
  console.log('⚡ Performance Comparison');

  const fibonacci = (n: number): number => {
    if (n <= 1) return n;
    let a = 0,
      b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  };

  const numbers = [35, 36, 37, 38, 39, 40];

  // Sequential execution
  console.time('Sequential');
  const sequentialResults = numbers.map(fibonacci);
  console.timeEnd('Sequential');
  console.log('Sequential results:', sequentialResults);

  // Parallel execution
  console.time('Parallel');
  const parallelResults = await threadts.map(numbers, fibonacci);
  console.timeEnd('Parallel');
  console.log('Parallel results:', parallelResults);
}

// Example 6: Error handling
async function errorHandlingExample() {
  console.log('🚨 Error Handling');

  try {
    await threadts.run(() => {
      throw new Error('Something went wrong!');
    });
  } catch (error: any) {
    console.log('Caught error:', error.message);
  }

  // Timeout example
  try {
    await threadts.run(
      () => {
        // Simulate long-running task
        const start = Date.now();
        while (Date.now() - start < 2000) {
          // Busy wait
        }
        return 'This should timeout';
      },
      null,
      { timeout: 1000 }
    );
  } catch (error: any) {
    console.log('Timeout error:', error.message);
  }
}

// Main execution
async function main() {
  try {
    console.log('🌟 ThreadTS Universal Examples\n');

    await basicExample();
    console.log('');

    await arrayOperationsExample();
    console.log('');

    await batchProcessingExample();
    console.log('');

    await decoratorExample();
    console.log('');

    await performanceComparison();
    console.log('');

    await errorHandlingExample();
    console.log('');

    // Pool statistics
    const stats = threadts.getStats();
    console.log('📊 Pool Statistics:', stats);

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  } finally {
    await threadts.terminate();
  }
}

// Run examples
main().catch(console.error);

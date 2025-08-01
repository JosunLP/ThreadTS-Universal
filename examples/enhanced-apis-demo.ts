/**
 * ThreadTS Universal - Enhanced Worker APIs Demo
 * Demonstrates Node.js, Deno, and Bun specific features
 */

import { BunWorkerAdapter } from '../src/adapters/bun';
import { DenoWorkerAdapter } from '../src/adapters/deno';
import { NodeWorkerAdapter } from '../src/adapters/node';
import { ThreadTS } from '../src/core/threadts';

async function demonstrateEnhancedAPIs() {
  console.log('🚀 ThreadTS Universal - Enhanced Worker APIs Demo');
  console.log('════════════════════════════════════════════════════════');

  // Test mathematical function for all platforms
  const heavyMathFunction = (n: number) => {
    let result = 0;
    for (let i = 0; i < n * 1000; i++) {
      result += Math.sqrt(i * Math.PI);
    }
    return result;
  };

  // Test Node.js enhanced features
  if (typeof process !== 'undefined') {
    console.log('\n📦 Node.js Enhanced Features Demo');
    console.log('─────────────────────────────────────');

    const nodeAdapter = new NodeWorkerAdapter();

    if (nodeAdapter.isSupported()) {
      console.log('✅ Node.js Worker Threads supported');

      const threadTS = ThreadTS.getInstance();

      try {
        // Test with resource limits
        const nodeResult = await threadTS.execute(heavyMathFunction, 5000, {
          timeout: 5000,
          resourceLimits: {
            maxOldGenerationSizeMb: 128,
            maxYoungGenerationSizeMb: 64,
            codeRangeSizeMb: 16,
            stackSizeMb: 4,
          },
          workerName: 'node-enhanced-worker',
          trackResources: true,
        });

        console.log(`📊 Node.js Result: ${nodeResult.result.toFixed(2)}`);
        console.log(`⏱️ Execution Time: ${nodeResult.executionTime}ms`);
        console.log(`🆔 Worker ID: ${nodeResult.workerId}`);

        // Test multiple concurrent operations with resource monitoring
        const concurrentTasks = Array.from({ length: 3 }, (_, i) => ({
          fn: heavyMathFunction,
          data: 1000 * (i + 1),
          options: {
            resourceLimits: {
              maxOldGenerationSizeMb: 64,
              maxYoungGenerationSizeMb: 32,
            },
            workerName: `concurrent-worker-${i}`,
          },
        }));

        const concurrentResults = await threadTS.parallel(concurrentTasks);
        console.log(
          `🔄 Concurrent Results: ${concurrentResults.map((r) => r.toFixed(2)).join(', ')}`
        );
      } catch (error) {
        console.log(
          `❌ Node.js execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      console.log('❌ Node.js Worker Threads not supported');
    }
  }

  // Test Deno enhanced features
  if (typeof (globalThis as any).Deno !== 'undefined') {
    console.log('\n🦕 Deno Enhanced Features Demo');
    console.log('─────────────────────────────────');

    const denoAdapter = new DenoWorkerAdapter();

    if (denoAdapter.isSupported()) {
      console.log('✅ Deno Workers supported');
      console.log(`📋 Deno Version: ${denoAdapter.getDenoVersion()}`);

      // Check permissions
      const hasHrtime = await denoAdapter.checkPermission('hrtime');
      console.log(
        `🕐 High-resolution time permission: ${hasHrtime ? '✅' : '❌'}`
      );

      const threadTS = ThreadTS.getInstance();

      try {
        // Test with fine-grained permissions
        const denoResult = await threadTS.execute(heavyMathFunction, 3000, {
          timeout: 5000,
          denoPermissions: {
            net: false,
            read: false,
            write: false,
            env: false,
            run: false,
            ffi: false,
            hrtime: true,
            sys: false,
          },
          workerName: 'deno-secure-worker',
          isolateContext: true,
        });

        console.log(`📊 Deno Result: ${denoResult.result.toFixed(2)}`);
        console.log(`⏱️ Execution Time: ${denoResult.executionTime}ms`);
        console.log(`🆔 Worker ID: ${denoResult.workerId}`);
      } catch (error) {
        console.log(
          `❌ Deno execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      console.log('❌ Deno Workers not supported');
    }
  }

  // Test Bun enhanced features
  if (typeof (globalThis as any).Bun !== 'undefined') {
    console.log('\n⚡ Bun Enhanced Features Demo');
    console.log('─────────────────────────────');

    const bunAdapter = new BunWorkerAdapter();

    if (bunAdapter.isSupported()) {
      console.log('✅ Bun Workers supported');
      console.log(`📋 Bun Version: ${bunAdapter.getBunVersion()}`);
      console.log(`🔧 Bun Revision: ${bunAdapter.getBunRevision()}`);

      const threadTS = ThreadTS.getInstance();

      try {
        // Test with Bun-specific optimizations
        const bunResult = await threadTS.execute(heavyMathFunction, 4000, {
          timeout: 5000,
          bunOptions: {
            name: 'bun-optimized-worker',
            credentials: 'omit',
            highPrecisionTiming: true,
            forceGC: true,
          },
          workerName: 'bun-enhanced-worker',
        });

        console.log(`📊 Bun Result: ${bunResult.result.toFixed(2)}`);
        console.log(`⏱️ Execution Time: ${bunResult.executionTime}ms`);
        console.log(`🆔 Worker ID: ${bunResult.workerId}`);

        // Demonstrate high-precision timing
        const startTime = bunAdapter.nanoseconds();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const endTime = bunAdapter.nanoseconds();
        console.log(
          `🕐 High-precision timing: ${((endTime - startTime) / 1000000).toFixed(3)}ms`
        );

        // Force garbage collection
        bunAdapter.gc(true);
        console.log('🧹 Forced garbage collection completed');
      } catch (error) {
        console.log(
          `❌ Bun execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      console.log('❌ Bun Workers not supported');
    }
  }

  // Cross-platform compatibility test
  console.log('\n🌐 Cross-Platform Compatibility Test');
  console.log('────────────────────────────────────');

  const threadTS = ThreadTS.getInstance();

  try {
    // Test with enhanced options that work across platforms
    const crossPlatformResult = await threadTS.execute(
      heavyMathFunction,
      2000,
      {
        timeout: 3000,
        priority: 'high',
        workerName: 'cross-platform-worker',
        maxRetries: 2,
        isolateContext: true,
        trackResources: true,
      }
    );

    console.log(
      `📊 Cross-platform Result: ${crossPlatformResult.result.toFixed(2)}`
    );
    console.log(`⏱️ Execution Time: ${crossPlatformResult.executionTime}ms`);
    console.log(`🆔 Worker ID: ${crossPlatformResult.workerId}`);
    console.log(`🖥️ Platform: ${threadTS.getPlatform()}`);
    console.log(`🔧 Worker Support: ${threadTS.isSupported() ? '✅' : '❌'}`);

    // Test transferable objects support (ArrayBuffer)
    const buffer = new ArrayBuffer(1024 * 1024); // 1MB buffer
    const uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < uint8Array.length; i++) {
      uint8Array[i] = i % 256;
    }

    const transferableResult = await threadTS.execute(
      (data: { buffer: ArrayBuffer }) => {
        const view = new Uint8Array(data.buffer);
        return view.reduce((sum, value) => sum + value, 0);
      },
      { buffer },
      {
        timeout: 2000,
        transferable: [buffer],
        workerName: 'transferable-test',
      }
    );

    console.log(
      `📦 Transferable Objects Test: Sum = ${transferableResult.result}`
    );
  } catch (error) {
    console.log(
      `❌ Cross-platform test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Performance comparison
  console.log('\n📈 Performance Comparison');
  console.log('─────────────────────────');

  const testSizes = [1000, 5000, 10000];

  for (const size of testSizes) {
    console.log(`\n🔢 Testing with size: ${size}`);

    // Synchronous execution
    const syncStart = performance.now();
    const syncResult = heavyMathFunction(size);
    const syncTime = performance.now() - syncStart;
    console.log(
      `  🔄 Sync: ${syncResult.toFixed(2)} (${syncTime.toFixed(2)}ms)`
    );

    // Parallel execution
    try {
      const parallelStart = performance.now();
      const parallelResult = await threadTS.run(heavyMathFunction, size, {
        timeout: 10000,
        priority: 'high',
      });
      const parallelTime = performance.now() - parallelStart;
      console.log(
        `  ⚡ Parallel: ${parallelResult.toFixed(2)} (${parallelTime.toFixed(2)}ms)`
      );

      const speedup = syncTime / parallelTime;
      console.log(
        `  📊 Speedup: ${speedup.toFixed(2)}x ${speedup > 1 ? '🚀' : '📉'}`
      );
    } catch (error) {
      console.log(
        `  ❌ Parallel execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  console.log('\n✅ Enhanced Worker APIs demo completed!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('  • Node.js resource limits and memory management');
  console.log('  • Deno fine-grained permissions and security');
  console.log('  • Bun high-precision timing and garbage collection');
  console.log('  • Cross-platform compatibility with enhanced options');
  console.log('  • Transferable objects support');
  console.log('  • Performance monitoring and comparison');
}

// Run the demo
demonstrateEnhancedAPIs().catch(console.error);

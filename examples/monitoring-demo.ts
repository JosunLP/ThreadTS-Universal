/**
 * ThreadTS Universal - Advanced Monitoring Demo
 * Demonstrates the new monitoring, error handling, and health check features
 */

import threadts, {
  ErrorHandler,
  HealthMonitor,
  PerformanceMonitor,
} from '../src/index';

// Create instances for the demo
const performanceMonitor = new PerformanceMonitor();
const errorHandler = new ErrorHandler();
const healthMonitor = new HealthMonitor();

async function demonstrateMonitoring() {
  console.log('🚀 ThreadTS Universal - Advanced Monitoring Demo');
  console.log('═'.repeat(55));

  // 1. Start monitoring systems
  console.log('\n📊 Starting monitoring systems...');
  performanceMonitor.startMonitoring(2000); // Every 2 seconds
  healthMonitor.startHealthMonitoring(5000); // Every 5 seconds

  // 2. Perform initial health check
  console.log('\n🏥 Performing initial health check...');
  const initialHealth = await healthMonitor.performHealthCheck();
  console.log(`Initial health status: ${initialHealth.overall.toUpperCase()}`);
  console.log(`Summary: ${initialHealth.summary}`);

  // 3. Demo normal operations with monitoring
  console.log('\n⚡ Demonstrating normal operations...');
  for (let i = 0; i < 10; i++) {
    try {
      const result = await threadts.run((x: number) => x * x, i);
      console.log(`✅ Operation ${i}: ${result}`);

      // Collect performance metrics
      performanceMonitor.collectMetrics();
    } catch (error) {
      console.error(`❌ Operation ${i} failed:`, error);
    }

    // Small delay to see monitoring in action
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 4. Demo error handling with recovery
  console.log('\n🚨 Demonstrating error handling and recovery...');

  try {
    await errorHandler.executeWithRetry(
      'demo-operation',
      async () => {
        // Simulate intermittent failure
        if (Math.random() > 0.7) {
          throw new Error('Simulated network error');
        }
        return 'Success!';
      },
      {
        platform: threadts.getPlatform(),
        workerCount: 1,
      }
    );
    console.log('✅ Operation completed successfully with auto-recovery');
  } catch (error) {
    console.log('❌ Operation failed even after recovery attempts');
  }

  // 5. Simulate memory-intensive operations
  console.log('\n💾 Testing memory-intensive operations...');
  const largeDataSets = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 10000 }, (_, j) => ({
      id: i * 10000 + j,
      value: Math.random(),
    }))
  );

  for (const [index, dataSet] of largeDataSets.entries()) {
    try {
      const result = await threadts.run(
        (data: Array<{ id: number; value: number }>) =>
          data.reduce((sum, item) => sum + item.value, 0),
        dataSet
      );
      console.log(`📈 Large dataset ${index}: sum = ${result.toFixed(2)}`);

      // Force performance monitoring
      performanceMonitor.collectMetrics();
    } catch (error) {
      console.error(`❌ Large dataset ${index} failed:`, error);
    }
  }

  // 6. Wait a bit for monitoring to collect data
  console.log('\n⏳ Collecting monitoring data...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 7. Generate comprehensive reports
  console.log('\n📊 Performance Report:');
  console.log(performanceMonitor.generateReport());

  console.log('\n🚨 Error Analysis Report:');
  console.log(errorHandler.generateErrorReport());

  console.log('\n🏥 Health Report:');
  console.log(healthMonitor.generateHealthReport());

  // 8. Test quick health check
  console.log('\n⚡ Quick Health Check:');
  const quickHealth = await healthMonitor.quickHealthCheck();
  console.log(`Status: ${quickHealth.status.toUpperCase()}`);
  console.log(`Message: ${quickHealth.message}`);

  // 9. Demo alerts and recommendations
  console.log('\n🔔 Recent Performance Alerts:');
  const alerts = performanceMonitor.getAlerts(5);
  if (alerts.length > 0) {
    alerts.forEach((alert, index) => {
      console.log(
        `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.message}`
      );
      if (alert.recommendations.length > 0) {
        console.log(`   Recommendations: ${alert.recommendations.join(', ')}`);
      }
    });
  } else {
    console.log('✅ No performance alerts');
  }

  // 10. Cleanup
  console.log('\n🧹 Cleaning up...');
  performanceMonitor.stopMonitoring();
  healthMonitor.stopHealthMonitoring();
  await threadts.terminate();

  console.log('\n✅ Monitoring demo completed successfully!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('  - Real-time performance monitoring');
  console.log('  - Automatic error detection and recovery');
  console.log('  - Comprehensive health checks');
  console.log('  - Memory usage tracking');
  console.log('  - Alert system with recommendations');
  console.log('  - Circuit breaker pattern for resilience');
  console.log('  - Detailed reporting and diagnostics');
}

// Advanced stress testing
async function stressTest() {
  console.log('\n🔥 Running Stress Test...');
  console.log('═'.repeat(30));

  // Start monitoring
  performanceMonitor.startMonitoring(1000);

  const startTime = Date.now();
  const operations: Promise<any>[] = [];

  // Create many concurrent operations
  for (let i = 0; i < 50; i++) {
    operations.push(
      threadts
        .run(
          (data: { iterations: number; complexity: number }) => {
            let result = 0;
            for (let j = 0; j < data.iterations; j++) {
              result += Math.sqrt(j * data.complexity);
            }
            return result;
          },
          { iterations: 1000, complexity: Math.random() * 100 }
        )
        .catch((error) => ({ error: error.message }))
    );
  }

  console.log(`⚡ Started ${operations.length} concurrent operations...`);

  const results = await Promise.all(operations);
  const endTime = Date.now();

  const successful = results.filter((r) => !r.error).length;
  const failed = results.length - successful;

  console.log(`\n📊 Stress Test Results:`);
  console.log(`  - Duration: ${endTime - startTime}ms`);
  console.log(`  - Total Operations: ${results.length}`);
  console.log(
    `  - Successful: ${successful} (${((successful / results.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `  - Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `  - Throughput: ${((results.length / (endTime - startTime)) * 1000).toFixed(1)} ops/sec`
  );

  performanceMonitor.stopMonitoring();
}

// Memory leak detection test
async function memoryLeakTest() {
  console.log('\n🧠 Memory Leak Detection Test...');
  console.log('═'.repeat(35));

  const initialMemory = process.memoryUsage?.() || { rss: 0 };
  console.log(
    `Initial memory: ${(initialMemory.rss / 1024 / 1024).toFixed(1)}MB`
  );

  // Create many operations that could potentially leak memory
  for (let i = 0; i < 100; i++) {
    await threadts.run(
      (data: number[]) => data.map((x) => x * 2).reduce((a, b) => a + b, 0),
      Array.from({ length: 1000 }, (_, j) => j)
    );

    if (i % 20 === 0) {
      const currentMemory = process.memoryUsage?.() || { rss: 0 };
      const memoryIncrease =
        (currentMemory.rss - initialMemory.rss) / 1024 / 1024;
      console.log(
        `Iteration ${i}: Memory increase: ${memoryIncrease.toFixed(1)}MB`
      );
    }
  }

  const finalMemory = process.memoryUsage?.() || { rss: 0 };
  const totalIncrease = (finalMemory.rss - initialMemory.rss) / 1024 / 1024;

  console.log(`\n📊 Memory Leak Test Results:`);
  console.log(
    `  - Initial Memory: ${(initialMemory.rss / 1024 / 1024).toFixed(1)}MB`
  );
  console.log(
    `  - Final Memory: ${(finalMemory.rss / 1024 / 1024).toFixed(1)}MB`
  );
  console.log(`  - Memory Increase: ${totalIncrease.toFixed(1)}MB`);
  console.log(
    `  - Status: ${totalIncrease < 10 ? '✅ PASSED' : '❌ POTENTIAL LEAK'}`
  );
}

async function main() {
  try {
    // Main monitoring demo
    await demonstrateMonitoring();

    // Additional tests
    await stressTest();
    await memoryLeakTest();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo directly
main().catch(console.error);

export default {
  demonstrateMonitoring,
  stressTest,
  memoryLeakTest,
};

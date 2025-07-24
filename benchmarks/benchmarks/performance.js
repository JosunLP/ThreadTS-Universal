"use strict";
/**
 * ThreadJS Universal - Comprehensive Performance Benchmarks
 * Misst die Performance verschiedener Parallelisierungs-Szenarien
 */
Object.defineProperty(exports, "__esModule", { value: true });
const threadjs_1 = require("../src/core/threadjs");
const platform_1 = require("../src/utils/platform");
const threadjs = threadjs_1.ThreadJS.getInstance();
const PERFORMANCE_THRESHOLD = 5; // Max 5ms Overhead
async function main() {
    console.log('🚀 ThreadJS Universal - Performance Benchmarks');
    console.log('═'.repeat(60));
    console.log(`Platform: ${threadjs.getPlatform()}`);
    console.log(`Worker Support: ${threadjs.isSupported()}`);
    console.log(`Performance Threshold: <${PERFORMANCE_THRESHOLD}ms overhead`);
    console.log('═'.repeat(60));
    const results = [];
    // 1. Simple Math Operations
    results.push(await benchmarkSimpleMath());
    // 2. Array Processing
    results.push(await benchmarkArrayProcessing());
    // 3. CPU-Intensive Task (Fibonacci)
    results.push(await benchmarkCPUIntensive());
    // 4. Batch Processing
    results.push(await benchmarkBatchProcessing());
    // 5. Large Data Transfer
    results.push(await benchmarkLargeDataTransfer());
    // Ergebnisse ausgeben
    console.log('\n📊 Performance Results:');
    console.log('═'.repeat(80));
    console.log('| Test Case            | Threaded | Sequential | Overhead | Speedup | Status |');
    console.log('|'.padEnd(81, '─') + '|');
    let passedTests = 0;
    for (const result of results) {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`| ${result.name.padEnd(20)} | ${result.threaded.toFixed(1).padStart(8)}ms | ${result.sequential.toFixed(1).padStart(10)}ms | ${result.overhead > 0 ? '+' : ''}${result.overhead.toFixed(1).padStart(7)}ms | ${result.speedup.toFixed(2).padStart(7)}x | ${status} |`);
        if (result.passed)
            passedTests++;
    }
    console.log('═'.repeat(80));
    console.log(`\n🎯 Summary: ${passedTests}/${results.length} tests passed`);
    const avgOverhead = results.reduce((sum, r) => sum + r.overhead, 0) / results.length;
    console.log(`📏 Average Overhead: ${avgOverhead.toFixed(2)}ms`);
    if (avgOverhead < PERFORMANCE_THRESHOLD) {
        console.log('🏆 PERFORMANCE TARGET ACHIEVED! Sub-5ms overhead maintained.');
    }
    else {
        console.log('⚠️  Performance target missed. Optimization needed.');
    }
    await threadjs.terminate();
}
async function benchmarkSimpleMath() {
    const testData = 12345;
    const iterations = 100;
    // Sequential
    const seqStart = (0, platform_1.getHighResTimestamp)();
    for (let i = 0; i < iterations; i++) {
        Math.sqrt(testData * testData + i);
    }
    const seqTime = (0, platform_1.getHighResTimestamp)() - seqStart;
    // Threaded
    const threadStart = (0, platform_1.getHighResTimestamp)();
    const promises = [];
    for (let i = 0; i < iterations; i++) {
        promises.push(threadjs.run((data) => Math.sqrt(data.base * data.base + data.offset), { base: testData, offset: i }));
    }
    await Promise.all(promises);
    const threadTime = (0, platform_1.getHighResTimestamp)() - threadStart;
    const overhead = (threadTime - seqTime) / iterations;
    const speedup = seqTime / threadTime;
    return {
        name: 'Simple Math',
        threaded: threadTime,
        sequential: seqTime,
        overhead,
        speedup,
        passed: overhead < PERFORMANCE_THRESHOLD
    };
}
async function benchmarkArrayProcessing() {
    const testArray = Array.from({ length: 1000 }, (_, i) => i + 1);
    // Sequential
    const seqStart = (0, platform_1.getHighResTimestamp)();
    const seqResult = testArray.map(x => x * x).filter(x => x % 2 === 0);
    const seqTime = (0, platform_1.getHighResTimestamp)() - seqStart;
    // Threaded
    const threadStart = (0, platform_1.getHighResTimestamp)();
    const threadResult = await threadjs.map(testArray, (x) => x * x, { batchSize: 50 });
    const filtered = threadResult.filter(x => x % 2 === 0);
    const threadTime = (0, platform_1.getHighResTimestamp)() - threadStart;
    const overhead = threadTime - seqTime;
    const speedup = seqTime / threadTime;
    return {
        name: 'Array Processing',
        threaded: threadTime,
        sequential: seqTime,
        overhead,
        speedup,
        passed: overhead < PERFORMANCE_THRESHOLD && seqResult.length === filtered.length
    };
}
async function benchmarkCPUIntensive() {
    const fibNumber = 35;
    const fibonacciSequential = (n) => {
        if (n <= 1)
            return n;
        return fibonacciSequential(n - 1) + fibonacciSequential(n - 2);
    };
    const fibonacciThreaded = (n) => {
        if (n <= 1)
            return n;
        return fibonacciThreaded(n - 1) + fibonacciThreaded(n - 2);
    };
    // Sequential
    const seqStart = (0, platform_1.getHighResTimestamp)();
    const seqResult = fibonacciSequential(fibNumber);
    const seqTime = (0, platform_1.getHighResTimestamp)() - seqStart;
    // Threaded
    const threadStart = (0, platform_1.getHighResTimestamp)();
    const threadResult = await threadjs.run(fibonacciThreaded, fibNumber);
    const threadTime = (0, platform_1.getHighResTimestamp)() - threadStart;
    const overhead = threadTime - seqTime;
    const speedup = seqTime / threadTime;
    return {
        name: 'CPU Intensive',
        threaded: threadTime,
        sequential: seqTime,
        overhead,
        speedup,
        passed: overhead < 10 && seqResult === threadResult // Relaxed threshold for CPU-intensive
    };
}
async function benchmarkBatchProcessing() {
    const tasks = Array.from({ length: 20 }, (_, i) => ({
        fn: (x) => {
            let sum = 0;
            for (let j = 0; j < x * 1000; j++) {
                sum += Math.sqrt(j);
            }
            return sum;
        },
        data: i + 1
    }));
    // Sequential
    const seqStart = (0, platform_1.getHighResTimestamp)();
    const seqResults = [];
    for (const task of tasks) {
        seqResults.push(task.fn(task.data));
    }
    const seqTime = (0, platform_1.getHighResTimestamp)() - seqStart;
    // Threaded
    const threadStart = (0, platform_1.getHighResTimestamp)();
    const threadResults = await threadjs.batch(tasks, 4);
    const threadTime = (0, platform_1.getHighResTimestamp)() - threadStart;
    const overhead = (threadTime - seqTime) / tasks.length;
    const speedup = seqTime / threadTime;
    return {
        name: 'Batch Processing',
        threaded: threadTime,
        sequential: seqTime,
        overhead,
        speedup,
        passed: overhead < PERFORMANCE_THRESHOLD && speedup > 0.8 // Should be faster with parallel processing
    };
}
async function benchmarkLargeDataTransfer() {
    const largeArray = new Float32Array(100000);
    for (let i = 0; i < largeArray.length; i++) {
        largeArray[i] = Math.random();
    }
    const processArray = (arr) => {
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += arr[i] * arr[i];
        }
        return sum;
    };
    // Sequential
    const seqStart = (0, platform_1.getHighResTimestamp)();
    const seqResult = processArray(largeArray);
    const seqTime = (0, platform_1.getHighResTimestamp)() - seqStart;
    // Threaded (note: this will include serialization overhead)
    const threadStart = (0, platform_1.getHighResTimestamp)();
    const threadResult = await threadjs.run((arr) => {
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += arr[i] * arr[i];
        }
        return sum;
    }, largeArray);
    const threadTime = (0, platform_1.getHighResTimestamp)() - threadStart;
    const overhead = threadTime - seqTime;
    const speedup = seqTime / threadTime;
    return {
        name: 'Large Data Transfer',
        threaded: threadTime,
        sequential: seqTime,
        overhead,
        speedup,
        passed: Math.abs(seqResult - threadResult) < 0.01 // Results should be nearly identical
    };
}
// Starte die Benchmarks
main().catch(console.error);

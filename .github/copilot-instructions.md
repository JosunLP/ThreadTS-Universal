# ThreadTS Universal - Copilot Instructions

## Architecture Overview

ThreadTS Universal is a **universal parallel computing library** that provides a unified API across all JavaScript runtimes (Browser, Node.js, Deno, Bun). The codebase follows a **Template Method pattern** with platform-specific adapters.

### Core Components

| Component           | Path                                                            | Purpose                                                                       |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ThreadTS`          | [src/core/threadts.ts](../src/core/threadts.ts)                 | Singleton entry point, exposes `run()`, `map()`, `filter()`, `reduce()`, etc. |
| `Pipeline`          | [src/core/pipeline.ts](../src/core/pipeline.ts)                 | Fluent API with lazy evaluation for chained operations                        |
| `ArrayOperations`   | [src/core/array-operations.ts](../src/core/array-operations.ts) | Extended Array API (ES2023+ methods)                                          |
| `Adapters`          | [src/adapters/](../src/adapters/)                               | Platform-specific Worker implementations                                      |
| `ThreadPoolManager` | [src/pool/manager.ts](../src/pool/manager.ts)                   | Worker pool with priority queues                                              |

### Adapter Strategy

```
AbstractWorkerInstance (base.ts)
├── NodeWorkerInstance (node.ts)     → worker_threads
├── BrowserWorkerInstance (browser.ts) → Web Workers + Blob URLs
├── DenoWorkerInstance (deno.ts)     → Deno Workers
└── BunWorkerInstance (bun.ts)       → Bun Workers
```

Platform detection happens in [src/utils/platform.ts](../src/utils/platform.ts). Functions are serialized via `createWorkerScript()` in [src/utils/serialization.ts](../src/utils/serialization.ts).

## Development Commands

```bash
npm run build          # Vite build → dist/esm/index.mjs + dist/index.cjs
npm run dev            # Vite watch mode
npm run test           # Vitest (forks pool for Worker isolation)
npm run test:local     # With --expose-gc for memory tests
npm run test:browser   # Playwright browser tests
npm run test:memory    # Memory leak tests
npm run benchmark      # Run performance benchmarks
npm run lint           # ESLint
```

**Important:** Tests use `vitest` with `pool: 'forks'` and `singleFork: true` because Worker thread tests require process isolation.

## Key Patterns

### 1. Singleton with Event System

`ThreadTS` extends `EventTarget` and uses a singleton pattern:

```typescript
const instance = ThreadTS.getInstance();
// Events: 'task-complete', 'task-error', 'pool-resize', 'worker-spawn'
```

### 2. Function Serialization

Functions passed to workers are serialized via `fn.toString()`. **Closures do NOT work** - all data must be passed explicitly:

```typescript
// ❌ Won't work - closure captured
const multiplier = 2;
await threadts.run((x) => x * multiplier, 21);

// ✅ Correct - data passed explicitly
await threadts.run((data) => data.x * data.m, { x: 21, m: 2 });
```

### 3. Decorator Suite

Located in [src/decorators/](../src/decorators/):

- **Parallel:** `@parallelMethod()`, `@parallel()`, `@parallelBatch()`, `@parallelMap()`
- **Caching:** `@memoize`, `@cache`, `@lazy`
- **Flow Control:** `@retry()`, `@rateLimit()`, `@timeout()`, `@debounce()`, `@throttle()`, `@circuitBreaker()`, `@concurrent()`
- **Observability:** `@logged()`, `@measure()`, `@validate()`

#### Decorator Configuration Examples

```typescript
// Retry with exponential backoff (base delay * 2^attempt)
@retry(3, 1000)  // 3 attempts, 1s base delay → 1s, 2s, 4s

// Circuit breaker to prevent cascading failures
@circuitBreaker({
  failureThreshold: 5,    // Open after 5 failures
  resetTimeout: 30000,    // Try again after 30s
  halfOpenRequests: 1     // Allow 1 test request in half-open state
})

// Parallel method with caching
@parallelMethod({
  poolSize: 4,
  timeout: 5000,
  cacheResults: true,
  priority: 'high'
})

// Rate limiting to X calls/second
@rateLimit(10)  // Max 10 calls per second

// Limit concurrent executions
@concurrent(5)  // Max 5 simultaneous executions
```

### 4. Pipeline Lazy Evaluation

Operations are queued until `execute()` or a terminal method is called:

```typescript
const result = await threadts
  .pipe([1, 2, 3, 4, 5])
  .map((x) => x * 2)
  .filter((x) => x > 4)
  .reduce((acc, x) => acc + x, 0);
```

## Testing Conventions

- Test files: `tests/*.test.ts` (Node) and `tests/browser/*.spec.ts` (Playwright)
- Mock Worker setup in [tests/setup.ts](../tests/setup.ts) for environments without Worker support
- Use `vi.mock('../src/utils/platform')` to control platform detection
- Reset singleton between tests: `Reflect.set(ThreadTS, '_instance', null)`

## Build Output

The library produces dual ESM/CJS output via Vite:

- `dist/esm/index.mjs` - ES Modules
- `dist/index.cjs` - CommonJS
- `dist/index.d.ts` - TypeScript declarations

Node.js built-ins (`worker_threads`, `os`, `path`, etc.) are externalized.

## Common Gotchas

1. **Worker script injection:** All worker code runs in isolation - no access to main thread scope
2. **Transferables:** Use `options.transferable` for ArrayBuffer zero-copy transfer
3. **Memory tests:** Require `--expose-gc` flag for forced garbage collection
4. **CI tests:** Use `npm run test:ci` with fork isolation for GitHub Actions

## Release Workflow

```bash
npm run release:patch  # 0.0.1 → 0.0.2 (bug fixes)
npm run release:minor  # 0.0.2 → 0.1.0 (new features)
npm run release:major  # 0.1.0 → 1.0.0 (breaking changes)
```

Release process (automated via `postversion`):

1. `npm version [patch|minor|major]` updates version in `package.json`
2. `git push && git push --tags` pushes commit and tag
3. `npm publish` publishes to npm registry

Pre-publish checks run automatically (`prepack`):

- Build → Test (excluding memory/browser) → Package validation

## Extending: Adding a New Platform Adapter

To add support for a new runtime (e.g., `cloudflare-workers`):

1. **Create adapter file** in `src/adapters/cloudflare.ts`:

```typescript
import { WorkerAdapter, WorkerInstance } from '../types';
import { AbstractWorkerInstance } from './base';

export class CloudflareWorkerAdapter implements WorkerAdapter {
  readonly platform = 'cloudflare' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new CloudflareWorkerInstance(script);
  }

  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  isSupported(): boolean {
    // Platform detection logic
    return typeof caches !== 'undefined' && 'default' in caches;
  }
}

class CloudflareWorkerInstance extends AbstractWorkerInstance {
  // Implement abstract methods from base.ts
}
```

2. **Add platform detection** in `src/utils/platform.ts`:

```typescript
// Add to detectPlatform()
if (typeof caches !== 'undefined' && 'default' in caches) {
  return 'cloudflare';
}
```

3. **Update types** in `src/types.ts`:

```typescript
export type Platform =
  | 'browser'
  | 'node'
  | 'deno'
  | 'bun'
  | 'cloudflare'
  | 'unknown';
```

4. **Add tests** in `tests/cloudflare.test.ts` with appropriate mocking

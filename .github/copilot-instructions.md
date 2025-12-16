# ThreadTS Universal - Copilot Instructions

## What this repo is

ThreadTS Universal is a universal parallel-computing library for Browser/Node/Deno/Bun.

## Where to look first

- Core API entry point: `src/core/threadts.ts` (singleton `ThreadTS`, events, `run/map/filter/reduce/...`).
- Pipeline (lazy ops + terminal ops): `src/core/pipeline.ts`, `src/core/pipeline-operations.ts`.
- Platform detection: `src/utils/platform.ts`.
- Serialization (function + data): `src/utils/serialization.ts` (`createWorkerScript()`).
- Worker pool: `src/pool/manager.ts`.
- Adapters per runtime: `src/adapters/*` (Template Method style).

## Non-negotiable constraints

- Preserve exported APIs and runtime behavior (this is a library). Avoid breaking changes in `src/index.ts` exports.
- If you add or change public APIs, update `README.md` and relevant files under `examples/`.
- Functions executed in workers are serialized (typically `fn.toString()`); closures don’t work. Pass all data explicitly.
- Prefer minimal, targeted diffs. Don’t reformat unrelated code.

## Tests & commands (match package.json)

- Build: `npm run build` (Vite → dual ESM/CJS in `dist/`).
- Unit tests: `npm run test` (Vitest). Pool config is in `vitest.config.ts` (`pool: 'forks'`, `singleFork: true`).
- Browser tests: `npm run test:browser` (Playwright, config in `playwright.config.ts`).
- Memory tests: `npm run test:memory` (use `npm run test:memory:local` to enable `--expose-gc`).

## Testing conventions

- Node tests: `tests/*.test.ts`; browser tests: `tests/browser/*.spec.ts`.
- Test mocks/bootstrap live in `tests/setup.ts`.
- If a test needs a fresh singleton: `Reflect.set(ThreadTS, '_instance', null)`.

## Adding a new runtime adapter (high level)

- Add an adapter in `src/adapters/<runtime>.ts` and extend `src/utils/platform.ts` detection + `src/types.ts` `Platform` union.
- Add focused tests under `tests/` (mock platform detection when needed).

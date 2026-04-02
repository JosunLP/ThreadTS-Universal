import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { execFileSyncMock, execSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  execSyncMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFileSync: execFileSyncMock,
  execSync: execSyncMock,
}));

import { DependencyManager } from '../scripts/dependency-manager';

describe('DependencyManager', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    execFileSyncMock.mockReset();
    execSyncMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('can be imported without executing the CLI flow', () => {
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  test('returns an empty list for empty outdated output', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue('   \n\t');

    await expect(manager.scanDependencies()).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ bun outdated --json returned empty output; assuming no outdated dependencies.'
    );
  });

  test('returns an empty list for invalid outdated output', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue('not json');

    await expect(manager.scanDependencies()).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('returns an empty list for unexpected outdated JSON types', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue('null');

    await expect(manager.scanDependencies()).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ bun outdated --json returned an unexpected JSON shape; assuming no outdated dependencies.'
    );
  });

  test('maps valid array outdated output to dependency info', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue(
      JSON.stringify([
        {
          name: 'array-package',
          current: '1.0.0',
          latest: '1.2.0',
          wanted: '1.1.0',
          location: 'dependencies',
        },
      ])
    );

    await expect(manager.scanDependencies()).resolves.toEqual([
      {
        name: 'array-package',
        current: '1.0.0',
        latest: '1.2.0',
        wanted: '1.1.0',
        location: 'dependencies',
        security: 'safe',
      },
    ]);
  });

  test('maps valid object outdated output to dependency info', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue(
      JSON.stringify({
        'object-package': {
          current: '2.0.0',
          latest: '3.0.0',
          wanted: '2.1.0',
          location: 'devDependencies',
        },
      })
    );

    await expect(manager.scanDependencies()).resolves.toEqual([
      {
        name: 'object-package',
        current: '2.0.0',
        latest: '3.0.0',
        wanted: '2.1.0',
        location: 'devDependencies',
        security: 'safe',
      },
    ]);
  });

  test('applies only patch updates in patch mode using the wanted version', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue('');

    const updated = await manager.performAutomaticUpdates(
      [
        {
          name: 'patch-only',
          current: '1.2.3',
          wanted: '1.2.4',
          latest: '1.3.0',
          location: 'direct',
          security: 'safe',
        },
        {
          name: 'minor-update',
          current: '1.2.3',
          wanted: '1.3.0',
          latest: '1.3.0',
          location: 'direct',
          security: 'safe',
        },
      ],
      'patch'
    );

    expect(updated).toEqual(['patch-only']);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'bun',
      ['update', 'patch-only@1.2.4'],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    );
  });

  test('applies only vulnerable dependencies in security mode using the latest version', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue('');

    const updated = await manager.performAutomaticUpdates(
      [
        {
          name: 'secure-package',
          current: '1.0.0',
          wanted: '1.0.1',
          latest: '1.0.1',
          location: 'direct',
          security: 'safe',
        },
        {
          name: 'vulnerable-package',
          current: '1.0.0',
          wanted: '1.0.1',
          latest: '2.0.0',
          location: 'direct',
          security: 'critical',
        },
      ],
      'security'
    );

    expect(updated).toEqual(['vulnerable-package']);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'bun',
      ['update', 'vulnerable-package@2.0.0'],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    );
  });

  test('returns an empty update list when no dependencies match the selected mode', async () => {
    const manager = new DependencyManager();

    const updated = await manager.performAutomaticUpdates(
      [
        {
          name: 'minor-update',
          current: '1.2.3',
          wanted: '1.3.0',
          latest: '1.3.0',
          location: 'direct',
          security: 'safe',
        },
      ],
      'patch'
    );

    expect(updated).toEqual([]);
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  test('treats prerelease to stable updates as patch updates in patch mode', async () => {
    const manager = new DependencyManager();
    execSyncMock.mockReturnValue('');

    const updated = await manager.performAutomaticUpdates(
      [
        {
          name: 'prerelease-package',
          current: '1.2.3-beta.1',
          wanted: '1.2.3',
          latest: '1.2.3',
          location: 'direct',
          security: 'safe',
        },
      ],
      'patch'
    );

    expect(updated).toEqual(['prerelease-package']);
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'bun',
      ['update', 'prerelease-package@1.2.3'],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    );
  });
});

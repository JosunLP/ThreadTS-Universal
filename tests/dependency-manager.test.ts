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
  beforeEach(() => {
    execFileSyncMock.mockReset();
    execSyncMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('can be imported without executing the CLI flow', () => {
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  test('returns an empty list for empty outdated output', async () => {
    const manager = new DependencyManager();
    const warnSpy = vi.spyOn(console, 'warn');
    execSyncMock.mockReturnValue('   \n\t');

    await expect(manager.scanDependencies()).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ bun outdated --json returned empty output; assuming no outdated dependencies.'
    );
  });

  test('returns an empty list for invalid outdated output', async () => {
    const manager = new DependencyManager();
    const warnSpy = vi.spyOn(console, 'warn');
    execSyncMock.mockReturnValue('not json');

    await expect(manager.scanDependencies()).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('returns an empty list for unexpected outdated JSON types', async () => {
    const manager = new DependencyManager();
    const warnSpy = vi.spyOn(console, 'warn');
    execSyncMock.mockReturnValue('null');

    await expect(manager.scanDependencies()).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ bun outdated --json returned an unexpected JSON shape; assuming no outdated dependencies.'
    );
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
});

#!/usr/bin/env bun

/**
 * ThreadTS Universal - Automated Dependencies Update Check
 * Autonomous dependency management with security scanning
 */

import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DependencyInfo {
  name: string;
  current: string;
  latest: string;
  wanted: string;
  location: string;
  security: 'safe' | 'warning' | 'critical';
}

interface UpdateReport {
  timestamp: string;
  totalDependencies: number;
  updates: DependencyInfo[];
  securityIssues: number;
  recommendation: 'proceed' | 'review' | 'halt';
}

type UpdateMode = 'auto' | 'security' | 'patch' | 'minor' | 'major' | 'all';

const VALID_UPDATE_MODES: UpdateMode[] = [
  'auto',
  'security',
  'patch',
  'minor',
  'major',
  'all',
];

function isUpdateMode(value: string): value is UpdateMode {
  return VALID_UPDATE_MODES.includes(value as UpdateMode);
}

interface CliOptions {
  mode: UpdateMode;
  reportOnly: boolean;
}

class DependencyManager {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Scans all dependencies for available updates
   */
  async scanDependencies(): Promise<DependencyInfo[]> {
    console.log('🔍 Scanning dependencies for updates...');

    try {
      const outdated = execSync('bun outdated --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });

      return this.parseOutdatedOutput(outdated);
    } catch (error: any) {
      if (error.stdout) {
        return this.parseOutdatedOutput(String(error.stdout));
      }
      return [];
    }
  }

  /**
   * Runs a security audit
   */
  async performSecurityAudit(
    dependencies: DependencyInfo[]
  ): Promise<DependencyInfo[]> {
    console.log('🛡️ Performing security audit...');

    try {
      const auditResult = execSync('bun audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });

      const auditData = JSON.parse(auditResult);

      // Apply security status to dependencies
      return dependencies.map((dep) => {
        const severity = this.getAuditSeverity(auditData, dep.name);

        if (severity === 'critical' || severity === 'high') {
          dep.security = 'critical';
        } else if (severity === 'moderate' || severity === 'low') {
          dep.security = 'warning';
        }

        return dep;
      });
    } catch (error) {
      console.warn('⚠️ Security audit failed, proceeding with caution');
      return dependencies;
    }
  }

  /**
   * Generates an update recommendation
   */
  generateRecommendation(
    dependencies: DependencyInfo[]
  ): 'proceed' | 'review' | 'halt' {
    const criticalCount = dependencies.filter(
      (d) => d.security === 'critical'
    ).length;
    const majorUpdates = dependencies.filter((d) => {
      const currentMajor = parseInt(d.current.split('.')[0]);
      const latestMajor = parseInt(d.latest.split('.')[0]);
      return latestMajor > currentMajor;
    }).length;

    if (criticalCount > 0) {
      return 'halt'; // Critical security issues
    }

    if (majorUpdates > 3) {
      return 'review'; // Too many major updates
    }

    return 'proceed'; // Safe to auto-update
  }

  /**
   * Performs automatic updates (safe updates only)
   */
  async performAutomaticUpdates(
    dependencies: DependencyInfo[],
    mode: UpdateMode = 'auto'
  ): Promise<string[]> {
    const updated: string[] = [];

    for (const dep of dependencies) {
      const targetVersion = this.getTargetVersion(dep, mode);
      if (targetVersion) {
        try {
          console.log(
            `📦 Updating ${dep.name}: ${dep.current} → ${targetVersion}`
          );
          execFileSync('bun', ['update', `${dep.name}@${targetVersion}`], {
            cwd: this.projectRoot,
            stdio: 'pipe',
          });
          updated.push(dep.name);
        } catch (error) {
          console.warn(`⚠️ Failed to update ${dep.name}`);
        }
      }
    }

    return updated;
  }

  private isSafeUpdate(dep: DependencyInfo): boolean {
    // Only perform patch and minor updates automatically
    const currentParts = this.parseVersion(dep.current);
    const wantedParts = this.parseVersion(dep.wanted);

    if (!currentParts || !wantedParts) {
      return false;
    }

    // Major update = breaking change
    if (wantedParts[0] > currentParts[0]) {
      return false;
    }

    return true;
  }

  private parseOutdatedOutput(output: string): DependencyInfo[] {
    const trimmed = output.trim();

    if (trimmed === '') {
      console.warn(
        '⚠️ bun outdated --json returned empty output; assuming no outdated dependencies.'
      );
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      console.warn(
        '⚠️ Failed to parse bun outdated --json output; assuming no outdated dependencies.',
        error
      );
      return [];
    }

    if (!parsed || typeof parsed !== 'object') {
      console.warn(
        '⚠️ bun outdated --json returned an unexpected JSON shape; assuming no outdated dependencies.'
      );
      return [];
    }

    if (Array.isArray(parsed)) {
      return parsed.map((entry: any) => ({
        name: entry.name,
        current: entry.current,
        latest: entry.latest,
        wanted: entry.wanted || entry.latest,
        location: entry.location || 'direct',
        security: 'safe',
      }));
    }

    return Object.entries(parsed as Record<string, any>).map(
      ([name, info]) => ({
        name,
        current: info.current,
        latest: info.latest,
        wanted: info.wanted || info.latest,
        location: info.location || 'direct',
        security: 'safe',
      })
    );
  }

  private getTargetVersion(
    dep: DependencyInfo,
    mode: UpdateMode
  ): string | null {
    const safeUpdateType = this.getUpdateType(dep.current, dep.wanted);
    const latestUpdateType = this.getUpdateType(dep.current, dep.latest);

    switch (mode) {
      case 'auto':
        return dep.security === 'safe' && this.isSafeUpdate(dep) ? dep.wanted : null;
      case 'security':
        return dep.security !== 'safe' && dep.current !== dep.latest
          ? dep.latest
          : null;
      case 'patch':
        return safeUpdateType === 'patch' ? dep.wanted : null;
      case 'minor':
        return safeUpdateType === 'patch' || safeUpdateType === 'minor'
          ? dep.wanted
          : null;
      case 'major':
        return latestUpdateType === 'major' ? dep.latest : null;
      case 'all':
        return dep.current !== dep.latest ? dep.latest : null;
      default:
        return null;
    }
  }

  private getUpdateType(
    currentVersion: string,
    targetVersion: string
  ): 'patch' | 'minor' | 'major' | 'none' | 'unknown' {
    const normalizedCurrentVersion = this.normalizeVersionString(currentVersion);
    const normalizedTargetVersion = this.normalizeVersionString(targetVersion);
    const currentParts = this.parseVersion(currentVersion);
    const targetParts = this.parseVersion(targetVersion);

    if (!currentParts || !targetParts) {
      return normalizedCurrentVersion === normalizedTargetVersion
        ? 'none'
        : 'unknown';
    }

    if (targetParts[0] > currentParts[0]) {
      return 'major';
    }

    if (targetParts[1] > currentParts[1]) {
      return 'minor';
    }

    if (targetParts[2] > currentParts[2]) {
      return 'patch';
    }

    if (
      currentParts[3] &&
      !targetParts[3] &&
      currentParts[0] === targetParts[0] &&
      currentParts[1] === targetParts[1] &&
      currentParts[2] === targetParts[2]
    ) {
      return 'patch';
    }

    return 'none';
  }

  private parseVersion(
    version: string
  ): [number, number, number, string | null] | null {
    const normalized = this.normalizeVersionString(version);
    const match = normalized.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
    );

    if (!match) {
      return null;
    }

    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] ?? null,
    ];
  }

  private normalizeVersionString(version: string): string {
    return version.trim().replace(/^[~^<>=\s]+/, '');
  }

  private getAuditSeverity(
    auditData: any,
    dependencyName: string
  ): string | undefined {
    const directMatch = auditData?.vulnerabilities?.[dependencyName];
    if (directMatch?.severity) {
      return directMatch.severity;
    }

    const advisories = auditData?.advisories;
    if (advisories && typeof advisories === 'object') {
      for (const advisory of Object.values(advisories) as any[]) {
        if (advisory?.module_name === dependencyName && advisory?.severity) {
          return advisory.severity;
        }
      }
    }

    const packages = auditData?.packages;
    if (packages && typeof packages === 'object') {
      for (const pkg of Object.values(packages) as any[]) {
        const issues = pkg?.issues || pkg?.vulnerabilities;
        if (!issues) {
          continue;
        }

        const normalizedIssues = Array.isArray(issues)
          ? issues
          : Object.values(issues as Record<string, any>);

        for (const issue of normalizedIssues) {
          if (issue?.name === dependencyName && issue?.severity) {
            return issue.severity;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Creates an update report
   */
  async generateReport(): Promise<UpdateReport> {
    const dependencies = await this.scanDependencies();
    const auditedDependencies = await this.performSecurityAudit(dependencies);
    const recommendation = this.generateRecommendation(auditedDependencies);

    const report: UpdateReport = {
      timestamp: new Date().toISOString(),
      totalDependencies: auditedDependencies.length,
      updates: auditedDependencies,
      securityIssues: auditedDependencies.filter((d) => d.security !== 'safe')
        .length,
      recommendation,
    };

    // Persist report
    const reportPath = path.join(
      this.projectRoot,
      'reports',
      'dependency-update.json'
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Displays a report summary
   */
  displayReport(report: UpdateReport): void {
    console.log('\n📋 Dependency Update Report');
    console.log('═'.repeat(50));
    console.log(`📅 Generated: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`📦 Total Updates Available: ${report.totalDependencies}`);
    console.log(`🛡️ Security Issues: ${report.securityIssues}`);
    console.log(`💡 Recommendation: ${report.recommendation.toUpperCase()}`);

    if (report.updates.length > 0) {
      console.log('\n📊 Available Updates:');
      console.log('─'.repeat(80));
      console.log(
        '| Package                     | Current | Latest  | Security |'
      );
      console.log(
        '|-----------------------------|---------|---------|---------·|'
      );

      for (const dep of report.updates) {
        const security =
          dep.security === 'safe'
            ? '✅'
            : dep.security === 'warning'
              ? '⚠️'
              : '🚨';
        console.log(
          `| ${dep.name.padEnd(27)} | ${dep.current.padEnd(7)} | ${dep.latest.padEnd(7)} | ${security.padEnd(8)} |`
        );
      }
    }

    console.log('\n🎯 Next Steps:');
    switch (report.recommendation) {
      case 'proceed':
        console.log('✅ Safe to proceed with automatic updates');
        break;
      case 'review':
        console.log('⚠️ Manual review recommended before updating');
        break;
      case 'halt':
        console.log(
          '🚨 Critical issues detected - manual intervention required'
        );
        break;
    }
  }
}

function parseCliOptions(args: string[]): CliOptions {
  let mode: UpdateMode = 'auto';
  let reportOnly = false;

  for (const arg of args) {
    if (arg === '--report-only') {
      reportOnly = true;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const candidate = arg.slice('--mode='.length);
      if (isUpdateMode(candidate)) {
        mode = candidate;
      } else {
        console.warn(`⚠️ Unknown update mode "${candidate}", using automatic mode.`);
      }
    }
  }

  return { mode, reportOnly };
}

function shouldPerformUpdates(
  report: UpdateReport,
  mode: UpdateMode
): boolean {
  if (mode === 'security') {
    return true;
  }

  if (mode === 'auto') {
    return report.recommendation === 'proceed';
  }

  return report.recommendation !== 'halt';
}

async function main(args = process.argv.slice(2)) {
  console.log('🤖 ThreadTS Universal - Autonomous Dependency Manager');
  console.log('═'.repeat(55));

  const manager = new DependencyManager();
  const options = parseCliOptions(args);

  try {
    // Generate report
    const report = await manager.generateReport();
    manager.displayReport(report);

    if (options.reportOnly) {
      console.log('\n📋 Report-only mode enabled; skipping automatic updates.');
      return;
    }

    const shouldUpdate = shouldPerformUpdates(report, options.mode);

    // Automatic updates when recommendation is safe
    if (shouldUpdate) {
      const updated = await manager.performAutomaticUpdates(
        report.updates,
        options.mode
      );

      if (updated.length > 0) {
        console.log(`\n✅ Successfully updated ${updated.length} packages:`);
        updated.forEach((pkg) => console.log(`  - ${pkg}`));

        // Run tests after updates
        console.log('\n🧪 Running tests after updates...');
        try {
          execSync('bun run test', { cwd: process.cwd(), stdio: 'inherit' });
          console.log('✅ All tests passed after updates');
        } catch (error) {
          console.log('❌ Tests failed after updates - reverting...');
          const revertTargets = ['package.json', 'bun.lock'].filter((file) =>
            fs.existsSync(path.join(process.cwd(), file))
          );

          if (fs.existsSync(path.join(process.cwd(), 'bun.lockb'))) {
            revertTargets.push('bun.lockb');
          }

          if (revertTargets.length > 0) {
            execFileSync('git', ['checkout', '--', ...revertTargets], {
              cwd: process.cwd(),
              stdio: 'inherit',
            });
          } else {
            console.warn(
              '⚠️ No dependency lock or package files found to revert; skipping git checkout.'
            );
          }

          throw error;
        }
      } else {
        console.log('\nℹ️ No dependencies matched the selected update mode.');
      }
    } else if (options.mode !== 'auto') {
      console.log(
        '\n🚫 Skipping updates because the dependency report requires manual intervention.'
      );
    }
  } catch (error: any) {
    console.error('❌ Dependency scan failed:', error.message);
    process.exit(1);
  }
}

// CLI execution - only run when this module is the entrypoint
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch(console.error);
}

export { DependencyManager };

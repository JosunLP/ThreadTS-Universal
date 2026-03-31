#!/usr/bin/env bun

/**
 * ThreadTS Universal - Automated Dependencies Update Check
 * Autonomous dependency management with security scanning
 */

import { execSync } from 'child_process';
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
        try {
          return this.parseOutdatedOutput(error.stdout);
        } catch (parseError) {
          console.warn('⚠️ Could not parse bun outdated output');
          return [];
        }
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
    dependencies: DependencyInfo[]
  ): Promise<string[]> {
    const updated: string[] = [];

    for (const dep of dependencies) {
      if (dep.security === 'safe' && this.isSafeUpdate(dep)) {
        try {
          console.log(
            `📦 Updating ${dep.name}: ${dep.current} → ${dep.wanted}`
          );
          execSync(`bun update --latest ${dep.name}`, {
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
    const currentParts = dep.current.split('.').map(Number);
    const wantedParts = dep.wanted.split('.').map(Number);

    // Major update = breaking change
    if (wantedParts[0] > currentParts[0]) {
      return false;
    }

    return true;
  }

  private parseOutdatedOutput(output: string): DependencyInfo[] {
    const parsed = JSON.parse(output);

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

async function main() {
  console.log('🤖 ThreadTS Universal - Autonomous Dependency Manager');
  console.log('═'.repeat(55));

  const manager = new DependencyManager();

  try {
    // Generate report
    const report = await manager.generateReport();
    manager.displayReport(report);

    // Automatic updates when recommendation is safe
    if (report.recommendation === 'proceed') {
      const updated = await manager.performAutomaticUpdates(report.updates);

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

          execSync(`git checkout -- ${revertTargets.join(' ')}`, {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Dependency scan failed:', error.message);
    process.exit(1);
  }
}

// CLI execution - directly execute when run with Bun
main().catch(console.error);

export { DependencyManager };

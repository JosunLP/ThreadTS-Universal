#!/usr/bin/env tsx

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
   * Scannt alle Dependencies auf Updates
   */
  async scanDependencies(): Promise<DependencyInfo[]> {
    console.log('🔍 Scanning dependencies for updates...');

    try {
      // npm outdated für Update-Info
      const outdated = execSync('npm outdated --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });

      const outdatedData = JSON.parse(outdated);
      const dependencies: DependencyInfo[] = [];

      for (const [name, info] of Object.entries(outdatedData as any)) {
        dependencies.push({
          name,
          current: (info as any).current,
          latest: (info as any).latest,
          wanted: (info as any).wanted,
          location: (info as any).location || 'direct',
          security: 'safe', // Wird durch Security-Scan aktualisiert
        });
      }

      return dependencies;
    } catch (error: any) {
      // npm outdated returns exit code 1 when updates are available
      if (error.stdout) {
        try {
          const outdatedData = JSON.parse(error.stdout);
          const dependencies: DependencyInfo[] = [];

          for (const [name, info] of Object.entries(outdatedData as any)) {
            dependencies.push({
              name,
              current: (info as any).current,
              latest: (info as any).latest,
              wanted: (info as any).wanted,
              location: (info as any).location || 'direct',
              security: 'safe',
            });
          }

          return dependencies;
        } catch (parseError) {
          console.warn('⚠️ Could not parse npm outdated output');
          return [];
        }
      }
      return [];
    }
  }

  /**
   * Führt Security-Audit durch
   */
  async performSecurityAudit(
    dependencies: DependencyInfo[]
  ): Promise<DependencyInfo[]> {
    console.log('🛡️ Performing security audit...');

    try {
      const auditResult = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });

      const auditData = JSON.parse(auditResult);
      const vulnerabilities = auditData.vulnerabilities || {};

      // Security-Status für Dependencies setzen
      return dependencies.map((dep) => {
        if (vulnerabilities[dep.name]) {
          const vuln = vulnerabilities[dep.name];
          if (vuln.severity === 'critical' || vuln.severity === 'high') {
            dep.security = 'critical';
          } else if (vuln.severity === 'moderate' || vuln.severity === 'low') {
            dep.security = 'warning';
          }
        }
        return dep;
      });
    } catch (error) {
      console.warn('⚠️ Security audit failed, proceeding with caution');
      return dependencies;
    }
  }

  /**
   * Erstellt Update-Empfehlung
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
   * Führt automatische Updates durch (nur sichere)
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
          execSync(`npm update ${dep.name}`, {
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
    // Nur Patch- und Minor-Updates automatisch durchführen
    const currentParts = dep.current.split('.').map(Number);
    const wantedParts = dep.wanted.split('.').map(Number);

    // Major-Update = Breaking Change
    if (wantedParts[0] > currentParts[0]) {
      return false;
    }

    return true;
  }

  /**
   * Erstellt Update-Report
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

    // Report speichern
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
   * Zeigt Report-Zusammenfassung
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
    // Report generieren
    const report = await manager.generateReport();
    manager.displayReport(report);

    // Automatische Updates bei sicherer Empfehlung
    if (report.recommendation === 'proceed') {
      const updated = await manager.performAutomaticUpdates(report.updates);

      if (updated.length > 0) {
        console.log(`\n✅ Successfully updated ${updated.length} packages:`);
        updated.forEach((pkg) => console.log(`  - ${pkg}`));

        // Tests nach Update ausführen
        console.log('\n🧪 Running tests after updates...');
        try {
          execSync('npm test', { cwd: process.cwd(), stdio: 'inherit' });
          console.log('✅ All tests passed after updates');
        } catch (error) {
          console.log('❌ Tests failed after updates - reverting...');
          execSync('git checkout -- package-lock.json', { cwd: process.cwd() });
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Dependency scan failed:', error.message);
    process.exit(1);
  }
}

// CLI execution - directly execute when imported by tsx
main().catch(console.error);

export { DependencyManager };

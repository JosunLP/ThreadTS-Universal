# 🚀 ThreadJS Universal - GitHub Actions Workflows

Dieses Verzeichnis enthält die umfassende CI/CD-Pipeline für das ThreadJS Universal Projekt.

## 📋 **Workflow-Übersicht**

### **1. 🚀 CI/CD Pipeline** (`ci-cd.yml`)

**Hauptworkflow für kontinuierliche Integration und Deployment**

- **Trigger:** Push/PR auf main/develop, täglicher Gesundheitscheck
- **Funktionen:**
  - Multi-OS Testing (Ubuntu, Windows, macOS)
  - Multi-Node.js Version Support (16, 18, 20, 21)
  - Browser-Kompatibilitätstests (Chrome, Safari, Firefox)
  - Security Scanning (CodeQL, Snyk)
  - Automatische Releases mit Semantic Versioning
  - Dokumentations-Deployment
  - Package-Verifikation

### **2. 🔄 Dependency Updates** (`dependency-updates.yml`)

**Automatisierte Dependency-Verwaltung und Sicherheitsüberwachung**

- **Trigger:** Wöchentlich (Montags), manuell
- **Funktionen:**
  - Wöchentliche Dependency-Scans
  - Security Vulnerability Monitoring
  - Intelligente Update-Kategorisierung (patch/minor/major)
  - Automatische Test-Ausführung nach Updates
  - Pull Request-Erstellung für Reviews
  - Security Team-Benachrichtigungen

### **3. ⚡ Performance Monitoring** (`performance-monitoring.yml`)

**Kontinuierliche Performance-Überwachung und Regression-Erkennung**

- **Trigger:** Push auf main, täglich, manuell
- **Funktionen:**
  - Core Performance Benchmarks
  - Memory Leak Detection
  - Real-World Scenario Testing
  - Performance Trend Analysis
  - Automatische Alerting bei Degradation
  - Dashboard Integration

### **4. 🌐 Platform Compatibility** (`platform-compatibility.yml`)

**Cross-Platform Kompatibilitätstests**

- **Trigger:** Push/PR, wöchentlich (Freitags), manuell
- **Funktionen:**
  - Browser-Kompatibilität (Chrome, Safari, Firefox)
  - Multi-Version Node.js Testing
  - Deno Compatibility Verification
  - Bun Compatibility Verification
  - Worker Support Validation
  - Feature Detection und Reporting

### **5. 🚀 Release Automation** (`release-automation.yml`)

**Vollautomatisierte Release-Pipeline**

- **Trigger:** Manuell (workflow_dispatch)
- **Funktionen:**
  - Pre-Release Validation
  - Automated Version Bumping
  - Changelog Generation
  - NPM Publishing
  - GitHub Release Creation
  - Dry Run Simulation
  - Post-Release Notifications

## 🔧 **Setup und Konfiguration**

### **Erforderliche GitHub Secrets:**

```bash
# NPM Publishing
NPM_TOKEN=<your-npm-token>

# Security Scanning (optional)
SNYK_TOKEN=<your-snyk-token>
CODECOV_TOKEN=<your-codecov-token>
```

### **Branch Protection Rules:**

```yaml
main:
  required_status_checks:
    - '🔍 Quality Gate'
    - '🧪 Test Matrix'
    - '🌐 Browser Tests'
    - '🔒 Security Scan'
  require_pull_request_reviews: true
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
```

## 📊 **Workflow-Matrix**

| Workflow      | Trigger | Duration | Artifacts          | Environment |
| ------------- | ------- | -------- | ------------------ | ----------- |
| CI/CD         | Push/PR | ~15min   | Coverage, Reports  | development |
| Dependencies  | Weekly  | ~5min    | Update Reports     | maintenance |
| Performance   | Daily   | ~10min   | Benchmarks         | monitoring  |
| Compatibility | Weekly  | ~20min   | Platform Reports   | testing     |
| Release       | Manual  | ~8min    | Packages, Releases | production  |

## 🎯 **Best Practices**

### **Workflow-Optimierung:**

- Parallelisierung wo möglich
- Artifact Caching für schnellere Builds
- Bedingte Ausführung basierend auf geänderten Dateien
- Resource-effiziente Matrix-Strategien

### **Security:**

- Least-privilege Prinzip für Secrets
- Environment Protection für Production
- Security Scanning in allen Workflows
- Vulnerability Alerting

### **Monitoring:**

- Performance Regression Detection
- Health Checks und Alerting
- Comprehensive Logging
- Trend Analysis

## 📈 **Metriken und Reporting**

### **Automatische Berichte:**

- **Code Coverage:** Codecov Integration
- **Performance Trends:** Benchmark History
- **Security Status:** Vulnerability Dashboard
- **Compatibility Matrix:** Platform Support Overview

### **Badge Integration:**

```markdown
![CI/CD](https://github.com/JosunLP/ThreadTS-Universal/workflows/CI%2FCD%20Pipeline/badge.svg)
![Performance](https://img.shields.io/badge/performance-optimized-green)
![Compatibility](https://img.shields.io/badge/platform%20compatibility-100%25-brightgreen)
```

## 🚨 **Troubleshooting**

### **Häufige Probleme:**

1. **Workflow Failures:**
   - Check der Logs in GitHub Actions Tab
   - Dependency-Konflikte prüfen
   - Node.js Version Compatibility

2. **Test Failures:**
   - Memory Leaks in Worker Pool
   - Platform-spezifische Issues
   - Timing-sensitive Tests

3. **Release Issues:**
   - NPM Token Expiration
   - Version Conflicts
   - Branch Protection Rules

### **Debug-Befehle:**

```bash
# Lokale Workflow-Simulation
act -j quality-gate

# Dependency-Check
npm run deps:check

# Performance-Test
npm run benchmark:all

# Platform-Test
npm run test:all
```

## 🔄 **Wartung und Updates**

### **Monatliche Tasks:**

- [ ] GitHub Actions Versions updaten
- [ ] Dependency Security Review
- [ ] Performance Baseline-Anpassung
- [ ] Workflow-Optimierung

### **Quartalsweise:**

- [ ] Platform Compatibility Matrix Review
- [ ] Security Best Practices Update
- [ ] Performance Targets Adjustment
- [ ] Documentation Sync

---

**📚 Weitere Ressourcen:**

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ThreadJS Universal Documentation](https://threadjs.dev)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Security Policy](../SECURITY.md)

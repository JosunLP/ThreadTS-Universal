# 🚀 ThreadTS Universal - GitHub Actions Workflows

This directory contains the comprehensive CI/CD pipeline for the ThreadTS Universal project.

## 📋 **Workflow overview**

### **1. 🚀 CI/CD Pipeline** (`ci-cd.yml`)

#### Primary workflow for continuous integration and deployment

- **Triggers:** Push/PR to main/develop, daily health check
- **Features:**
  - Multi-OS Testing (Ubuntu, Windows, macOS)
  - Multi-Node.js Version Support (16, 18, 20, 21)
  - Browser compatibility tests (Chrome, Safari, Firefox)
  - Security Scanning (CodeQL, Snyk)
  - Automated releases with semantic versioning
  - Documentation deployment
  - Package verification

### **2. 🔄 Dependency Updates** (`dependency-updates.yml`)

#### Automated dependency management and security monitoring

- **Triggers:** Weekly (Mondays), manual
- **Features:**
  - Weekly dependency scans
  - Security Vulnerability Monitoring
  - Smart update categorization (patch/minor/major)
  - Automatic test execution after updates
  - Pull request creation for reviews
  - Security team notifications

### **3. ⚡ Performance Monitoring** (`performance-monitoring.yml`)

#### Continuous performance monitoring and regression detection

- **Triggers:** Push to main, daily, manual
- **Features:**
  - Core Performance Benchmarks
  - Memory Leak Detection
  - Real-World Scenario Testing
  - Performance Trend Analysis
  - Automated alerting on degradation
  - Dashboard Integration

### **4. 🌐 Platform Compatibility** (`platform-compatibility.yml`)

#### Cross-platform compatibility tests

- **Triggers:** Push/PR, weekly (Fridays), manual
- **Features:**
  - Browser compatibility (Chrome, Safari, Firefox)
  - Multi-Version Node.js Testing
  - Deno Compatibility Verification
  - Bun Compatibility Verification
  - Worker Support Validation
  - Feature detection and reporting

### **5. 🚀 Release Automation** (`release-automation.yml`)

#### Fully automated release pipeline

- **Trigger:** GitHub release publication (`release.published`)
- **Features:**
  - Pre-Release Validation
  - npm trusted publishing via GitHub OIDC
  - npmjs.org deployment after publishing a release
  - Release asset upload
  - Post-Release Notifications

## 🔧 **Setup and configuration**

### **Required GitHub secrets**

```bash
# Security Scanning (optional)
SNYK_TOKEN=<your-snyk-token>
CODECOV_TOKEN=<your-codecov-token>
```

### **Required external configuration**

- Configure the repository as an npm trusted publisher on npmjs.org for GitHub Actions OIDC publishing.

### **Branch protection rules**

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

## 📊 **Workflow matrix**

| Workflow      | Trigger | Duration | Artifacts          | Environment |
| ------------- | ------- | -------- | ------------------ | ----------- |
| CI/CD         | Push/PR | ~15min   | Coverage, Reports  | development |
| Dependencies  | Weekly  | ~5min    | Update Reports     | maintenance |
| Performance   | Daily   | ~10min   | Benchmarks         | monitoring  |
| Compatibility | Weekly  | ~20min   | Platform Reports   | testing     |
| Release       | Manual  | ~8min    | Packages, Releases | production  |

## 🎯 **Best practices**

### **Workflow optimization**

- Parallelize where possible
- Artifact caching for faster builds
- Conditional execution based on changed files
- Resource-efficient matrix strategies

### **Security**

- Least-privilege principle for secrets
- Environment protection for production
- Security scanning in all workflows
- Vulnerability alerting

### **Monitoring**

- Performance regression detection
- Health checks and alerting
- Comprehensive logging
- Trend analysis

## 📈 **Metrics and reporting**

### **Automated reports**

- **Code Coverage:** Codecov Integration
- **Performance Trends:** Benchmark History
- **Security Status:** Vulnerability Dashboard
- **Compatibility Matrix:** Platform Support Overview

### **Badge integration:**

```markdown
![CI/CD](https://github.com/JosunLP/ThreadTS-Universal/workflows/CI%2FCD%20Pipeline/badge.svg)
![Performance](https://img.shields.io/badge/performance-optimized-green)
![Compatibility](https://img.shields.io/badge/platform%20compatibility-100%25-brightgreen)
```

## 🚨 **Troubleshooting**

### **Common issues**

#### Workflow failures

- Check the logs in the GitHub Actions tab
- Check for dependency conflicts
- Node.js version compatibility

#### Test failures

- Memory leaks in the worker pool
- Platform-specific issues
- Timing-sensitive tests

#### Release issues

- NPM token expiration
- Version conflicts
- Branch protection rules

### **Debug commands**

```bash
# Local workflow simulation
act -j quality-gate

# Dependency check
bun run deps:check

# Performance test
bun run benchmark:all

# Platform test
bun run test:all
```

## 🔄 **Maintenance and updates**

### **Monthly tasks**

- [ ] Update GitHub Actions versions
- [ ] Dependency security review
- [ ] Performance baseline adjustment
- [ ] Workflow optimization

### **Quarterly**

- [ ] Platform compatibility matrix review
- [ ] Security best practices update
- [ ] Performance targets adjustment
- [ ] Documentation sync

---

**📚 More resources:**

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ThreadTS Universal Documentation](https://threadts.dev)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Security Policy](../SECURITY.md)

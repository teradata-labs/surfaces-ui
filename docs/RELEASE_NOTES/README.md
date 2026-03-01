# Release Notes

This directory contains release notes for SurfacesUI following [OpenSSF Best Practices](https://best.openssf.org/) guidelines.

## Release Notes Standards

Our release notes follow OpenSSF (Open Source Security Foundation) best practices to ensure transparency, security, and trust for our users.

### Structure

Each release is documented in a separate markdown file named `vX.Y.Z.md` following [Semantic Versioning](https://semver.org/):

- **MAJOR** (X): Breaking changes
- **MINOR** (Y): New features (backward compatible)
- **PATCH** (Z): Bug fixes (backward compatible)

### Required Sections

Every release note MUST include:

1. **Version & Date**: Clear version number and release date
2. **Summary**: High-level overview of the release
3. **Security Fixes**: Any security vulnerabilities addressed (CVE numbers when applicable)
4. **Breaking Changes**: Changes that break backward compatibility
5. **New Features**: New functionality added
6. **Bug Fixes**: Issues resolved
7. **Dependencies**: Updated dependencies with security implications
8. **Deprecations**: Features marked for removal
9. **Contributors**: Acknowledgment of contributors
10. **Verification**: Instructions for verifying the release

### Security Disclosure

Security vulnerabilities are disclosed following responsible disclosure practices:

- Critical vulnerabilities are highlighted at the top of release notes
- CVE identifiers are included when assigned
- Affected versions are clearly stated
- Upgrade paths are documented

### Example Format

```markdown
# Release v0.1.0 - YYYY-MM-DD

## Summary
Brief description of the release.

## 🔒 Security Fixes
- **CVE-YYYY-XXXXX**: Description of vulnerability and fix
- Severity: Critical/High/Medium/Low

## ⚠️ Breaking Changes
- Change description with migration guide

## ✨ New Features
- Feature description

## 🐛 Bug Fixes
- Bug fix description

## 📦 Dependencies
- Updated package@version (security fix)

## 🗑️ Deprecations
- Deprecated feature (will be removed in vX.Y.Z)

## 👥 Contributors
- @contributor1
- @contributor2

## ✅ Verification
Instructions for verifying the release integrity.
```

## Release Process

### 1. Prepare Release Notes

Before creating a release:

1. Review all commits since last release
2. Categorize changes (security, breaking, features, bugs)
3. Check for dependency updates with security implications
4. Document breaking changes with migration guides
5. List all contributors

### 2. Create Release File

```bash
# Create new release notes file
cp docs/RELEASE_NOTES/TEMPLATE.md docs/RELEASE_NOTES/vX.Y.Z.md

# Edit the file with release details
# Commit before tagging
git add docs/RELEASE_NOTES/vX.Y.Z.md
git commit -m "docs: add release notes for vX.Y.Z"
```

### 3. Tag Release

```bash
# Create signed tag (requires GPG key)
git tag -s vX.Y.Z -m "Release vX.Y.Z"

# Push tag
git push origin vX.Y.Z
```

### 4. GitHub Release

Create a GitHub release:

1. Go to Releases → Draft a new release
2. Select the tag
3. Copy content from `vX.Y.Z.md`
4. Mark as "pre-release" if applicable
5. Publish release

## Security Considerations

### CVE Assignment

If a security vulnerability is fixed:

1. Request CVE from [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories)
2. Include CVE number in release notes
3. Update security advisory with fix details
4. Link to release notes from advisory

### Vulnerability Disclosure Timeline

- **Day 0**: Vulnerability discovered and verified
- **Day 1-7**: Private fix developed and tested
- **Day 7**: Coordinated disclosure to users
- **Day 7+**: Public release with fix and CVE details

### Emergency Releases

For critical security fixes:

1. Create hotfix branch from latest release
2. Apply minimal fix
3. Fast-track testing
4. Release with clear security advisory
5. Notify users via multiple channels

## OpenSSF Scorecard

We track our OpenSSF Scorecard score to ensure adherence to security best practices:

- **Security Policy**: See SECURITY.md
- **Signed Releases**: All releases are signed
- **Dependency Updates**: Automated via Dependabot
- **Code Review**: All changes require review
- **CII Best Practices**: Target CII Best Practices badge

## Compliance

Our release notes comply with:

- [OpenSSF Best Practices](https://best.openssf.org/)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Security Disclosure Guidelines](https://github.com/ossf/oss-vulnerability-guide)

## Resources

- [OpenSSF Best Practices Badge](https://bestpractices.coreinfrastructure.org/)
- [CVE Numbering Authorities](https://www.cve.org/ResourcesSupport/AllResources/CNAs)
- [Coordinated Vulnerability Disclosure](https://vuls.cert.org/confluence/display/CVD)
- [Supply Chain Security](https://slsa.dev/)

## Questions?

For questions about releases or security:

- Security issues: See [SECURITY.md](../../SECURITY.md)
- General questions: Open an issue on GitHub
- Private security concerns: security@your-domain.com (if configured)

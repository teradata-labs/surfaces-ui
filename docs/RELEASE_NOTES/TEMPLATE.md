# Release vX.Y.Z - YYYY-MM-DD

## Summary

[Brief high-level overview of this release - 2-3 sentences]

**Release Type**: [Major/Minor/Patch/Hotfix]
**Risk Level**: [Low/Medium/High/Critical]
**Recommended Action**: [Upgrade recommended/Required for security/Optional]

---

## 🔒 Security Fixes

**[If none: "No security vulnerabilities addressed in this release"]**

### CVE-YYYY-XXXXX: [Vulnerability Title]

- **Severity**: [Critical/High/Medium/Low]
- **CVSS Score**: X.X
- **Affected Versions**: vX.Y.Z - vX.Y.Z
- **Fixed In**: vX.Y.Z
- **Description**: [Detailed description of vulnerability]
- **Impact**: [What attackers could do]
- **Mitigation**: [How users can protect themselves before upgrading]
- **Credit**: [Security researcher who reported it]

**Upgrade Instructions**:
```bash
# Commands to upgrade
```

---

## ⚠️ Breaking Changes

**[If none: "None"]**

### Change Title

**What Changed**: [Description of the breaking change]

**Why**: [Rationale for the breaking change]

**Migration Guide**:

```typescript
// Before
const oldCode = doSomethingOld();

// After
const newCode = doSomethingNew();
```

**Affected APIs**:
- `functionName()` - [Change description]
- `ComponentName` - [Change description]

---

## ✨ New Features

### Feature Name

[Detailed description of the feature]

**Usage Example**:

```typescript
// Example code
import { NewFeature } from '@surfacesui/components';

function MyComponent() {
  return <NewFeature prop="value" />;
}
```

**Benefits**:
- Benefit 1
- Benefit 2

---

## 🐛 Bug Fixes

### Category: [Component/System/Build/etc]

- **Fixed**: [Description of bug] (#issue-number)
  - **Impact**: Who was affected
  - **Root Cause**: What caused it
  - **Resolution**: How it was fixed

---

## 📦 Dependencies

### Updated Dependencies

| Package | Old Version | New Version | Type | Security | Notes |
|---------|-------------|-------------|------|----------|-------|
| `package-name` | `1.0.0` | `2.0.0` | Major | ⚠️ CVE-YYYY-XXXXX | Security fix |
| `another-package` | `1.5.0` | `1.6.0` | Minor | ✅ No CVEs | Feature update |

### New Dependencies

- `new-package@^1.0.0` - [Purpose and justification]

### Removed Dependencies

- `old-package` - [Reason for removal, alternative if applicable]

### CVE Status

- ✅ No Common Vulnerabilities and Exposures (CVEs) in dependencies
- ⚠️ [Number] CVEs addressed in this release

**Vulnerability Summary**:
```bash
pnpm audit
# [Paste audit output or summary]
```

---

## 🗑️ Deprecations

**[If none: "None in this release"]**

### Deprecated Feature/API

- **Deprecated**: `oldFunction()`
- **Alternative**: Use `newFunction()` instead
- **Removal Date**: Will be removed in vX.Y.Z (estimated [date])
- **Migration Guide**: [Link to migration docs]

---

## 📊 Performance

### Improvements

- [Performance improvement description] - X% faster
- [Bundle size reduction] - Xkb smaller

### Benchmarks

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Bundle size (gzipped) | XYZ KB | XYZ KB | -X% |
| Initial load time | X ms | X ms | -X% |
| Time to Interactive | X ms | X ms | -X% |

---

## 🧪 Testing

### Coverage

- **Overall Coverage**: XX%
- **Components**: XX%
- **Integration Tests**: XX new tests added

### New Tests

- [Test category]: X tests added
- [Test category]: X tests added

### Known Issues

- [Issue description] (#issue-number) - [Workaround if available]

---

## 🏗️ Architecture

### Changes

[Describe any significant architectural changes]

### Compatibility

- **Node.js**: >= X.Y.Z
- **React**: >= X.Y.Z
- **Browsers**: [List supported browsers]
- **MCP Protocol**: [Version]

---

## 🚀 Installation & Upgrade

### New Installation

```bash
# Installation commands
```

### Upgrade from vX.Y.Z

```bash
# Upgrade commands
pnpm update @surfacesui/components @surfacesui/mcp-adapter @surfacesui/server

# If breaking changes exist:
# [Additional upgrade steps]
```

### Post-Upgrade Checklist

- [ ] Run tests: `pnpm test`
- [ ] Rebuild apps: `pnpm build:apps`
- [ ] Update Claude Desktop config (if needed)
- [ ] Verify MCP server: `npx @modelcontextprotocol/inspector node packages/server/dist/index.js`
- [ ] [Add any other verification steps]

---

## 🔍 Verification

### Package Integrity

```bash
# Verify installation
pnpm list @surfacesui/components @surfacesui/mcp-adapter @surfacesui/server

# Run tests
pnpm test

# Check for vulnerabilities
pnpm audit
```

### Checksums (if applicable)

```
SHA256 (package.tar.gz) = [checksum]
```

### GPG Signature (if applicable)

```bash
# Verify signature
gpg --verify package.tar.gz.asc package.tar.gz
```

---

## 👥 Contributors

This release includes contributions from:

- **@username** - [Contribution summary]
- **@username** - [Contribution summary]

**New Contributors** 🎉
- **@newuser** made their first contribution!

Thank you to everyone who contributed to this release!

---

## 📄 License

Apache License 2.0 - See [LICENSE](../../LICENSE) file for details

---

## 🔗 Resources

- **Repository**: https://github.com/teradata-labs/surfaces-ui
- **Documentation**: [Link to docs]
- **Issues**: https://github.com/teradata-labs/surfaces-ui/issues
- **Changelog**: [Link to CHANGELOG.md]
- **Discussions**: https://github.com/teradata-labs/surfaces-ui/discussions

---

## 📝 Release Checklist

- [ ] All tests passing
- [ ] Dependencies updated and audited
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Release notes created (this file)
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)
- [ ] Security review completed
- [ ] Performance benchmarks run
- [ ] Accessibility compliance verified
- [ ] Git tag created and signed
- [ ] GitHub release published
- [ ] npm packages published
- [ ] Announcement prepared
- [ ] Community notified

---

## 🎯 Next Steps

### Planned for vX.Y.Z

- [Feature 1]
- [Feature 2]
- [Improvement 1]

### Long-term Roadmap

See [ROADMAP.md](../../docs/plans/ROADMAP.md) for future plans.

### Feedback

We welcome feedback on this release:

- Report issues: [Link]
- Feature requests: [Link]
- Security concerns: See [SECURITY.md](../../SECURITY.md)

---

**Release Date**: [Date]
**Release Manager**: [Name]
**Next Release**: vX.Y.Z (Estimated: [Date])

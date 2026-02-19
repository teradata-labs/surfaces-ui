# Security Policy

## Credential Management

This repository follows strict security practices to protect sensitive information.

### ✅ DO:

1. **Use Environment Variables**
   - Store credentials in `.env` files (gitignored)
   - Use `TD_USER`, `TD_PASSWORD`, `TD_HOST` environment variables
   - Never hardcode credentials in source code or configuration

2. **Use Placeholders in Documentation**
   - Example: `your_username`, `your_password`
   - Example: `your-host.teradata.com`
   - Example: `$HOME/repos/` instead of absolute paths

3. **Follow the .gitignore**
   - The `.gitignore` is pre-configured to exclude:
     - `.env*` files
     - Virtual environments (`venv/`, `.venv/`)
     - IDE configurations with potential secrets

4. **Review Before Commit**
   - Run `git diff` before committing
   - Check for hardcoded credentials or personal paths
   - Use the security audit checklist below

### ❌ DON'T:

1. **Never Commit Real Credentials**
   - No usernames/passwords in any files
   - No API keys or tokens
   - No connection strings with embedded credentials
   - No private keys or certificates

2. **Never Commit Personal Information**
   - No absolute file paths with usernames
   - No personal email addresses (except in git history)
   - No internal IP addresses or hostnames

3. **Never Use Default Credentials in Production**
   - `dbc/dbc` is a known default Teradata credential
   - Always use unique, strong credentials for real databases

## Configuration Examples

### Local Development (.env file - gitignored)

```bash
# .env (never commit this file)
TD_USER=your_actual_username
TD_PASSWORD=your_actual_password
TD_HOST=your-actual-host.clearscape.teradata.com
```

### Documentation (use placeholders)

```bash
# Example in README.md or docs
export TD_USER="your_username"
export TD_PASSWORD="your_password"
export TD_HOST="your-host.teradata.com"
```

### Claude Desktop Config

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "/path/to/python",
      "args": ["-m", "src.main"],
      "env": {
        "TD_USER": "your-username",
        "TD_PASSWORD": "your-password",
        "TD_HOST": "your-vantage-host.teradata.com"
      }
    }
  }
}
```

## Security Audit Checklist

Before making the repository public or sharing with external collaborators:

- [ ] No real credentials in any files (search for passwords, API keys)
- [ ] No personal file paths (search for `/Users/`, `/home/username`)
- [ ] No internal hostnames or IP addresses
- [ ] `.env` files are gitignored
- [ ] Documentation uses placeholders, not real values
- [ ] Test files use environment variables, not hardcoded credentials
- [ ] Git history reviewed (consider `git filter-branch` if needed)

## Reporting Security Issues

If you discover a security vulnerability in this repository:

1. **Do NOT** open a public issue
2. Contact the repository maintainers directly
3. Provide details of the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Credential Rotation

If credentials are accidentally committed:

1. **Immediately** rotate the exposed credentials
2. Remove credentials from the repository files
3. Consider cleaning git history with BFG Repo-Cleaner or `git filter-branch`
4. Review access logs for unauthorized usage

## Tools and Automation

Consider adding these tools to your workflow:

- **git-secrets** - Prevents committing secrets
- **truffleHog** - Scans git history for secrets
- **GitHub Secret Scanning** - Automatic detection (if using GitHub)
- **Pre-commit hooks** - Validate files before commit

### Example Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Check for potential secrets before commit

if git diff --cached | grep -E "(password|api_key|secret|token|TD_PASSWORD).*=.*['\"]?[^'\"]+['\"]?" | grep -v "your_"; then
    echo "ERROR: Potential credential found in commit!"
    echo "Please use placeholders like 'your_username' instead."
    exit 1
fi
```

## Best Practices Summary

1. ✅ Store secrets in `.env` files (gitignored)
2. ✅ Use environment variables in code
3. ✅ Use placeholders in documentation
4. ✅ Review diffs before committing
5. ✅ Rotate credentials if exposed
6. ✅ Enable automated scanning tools
7. ❌ Never commit real credentials
8. ❌ Never use default credentials in production

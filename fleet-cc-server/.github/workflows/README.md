# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD.

## Workflows

### `ci.yml`
Main CI pipeline that runs on all pull requests and pushes to `main`/`master`:
- Lints backend and frontend code
- **Verifies Swagger documentation** (blocks merge if fails)
- Builds backend and frontend
- Ensures code quality before merging

### `docs-verification.yml`
Focused workflow that runs only when documentation-related files change:
- Runs only when route files, Swagger config, or verification script changes
- Verifies all protected routes have proper security annotations
- Faster feedback for documentation-only changes

## Required Status Checks

To enforce that documentation verification must pass before merging:

1. Go to your repository settings
2. Navigate to **Branches** → **Branch protection rules**
3. Add or edit the rule for `main` branch
4. Under **Require status checks to pass before merging**, enable:
   - ✅ `Verify Swagger Documentation` (from `docs-verification.yml`)
   - ✅ `Lint and Test` (from `ci.yml`)

This ensures that no code can be merged without passing documentation verification.


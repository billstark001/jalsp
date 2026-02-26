# CI/CD Workflows Documentation

This repository contains two GitHub Actions workflows for automating testing, building, and publishing processes.

## CI Workflow (.github/workflows/ci.yml)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop` branches

**Steps:**

1. Run tests on multiple Node.js versions (18, 20, 22)
2. Install dependencies (using pnpm)
3. Run Lint checks
4. Run all tests
5. Build all packages
6. Upload build artifacts (Node.js 20 only)

## Publish Workflow (.github/workflows/publish.yml)

**Triggers:**

- Creating a new GitHub Release
- Manual trigger (with option to publish individual or all packages)

**Steps:**

1. Install dependencies
2. Run tests
3. Build all packages
4. Publish to NPM

## Configuration

### NPM Token Setup

Before publishing to NPM, you need to set up an NPM Token in your GitHub repository:

1. Visit [npmjs.com](https://www.npmjs.com/) and log in
2. Go to Access Tokens page
3. Create a new Automation Token
4. In your GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name it `NPM_TOKEN`
   - Paste your NPM token

### Release Process

#### Option 1: Publish via GitHub Release

```bash
# 1. Update version numbers
cd packages/jalsp
npm version patch|minor|major

cd ../jalsp-cli
npm version patch|minor|major

# 2. Commit and push
git add .
git commit -m "chore: bump version to x.x.x"
git push

# 3. Create tag
git tag vx.x.x
git push origin vx.x.x

# 4. Create a Release on GitHub
# Go to repository page → Releases → Create a new release
# Select the tag you just created, publishing will automatically trigger the publish workflow
```

#### Option 2: Manual Trigger

1. Go to your GitHub repository's Actions page
2. Select the "Publish to NPM" workflow
3. Click "Run workflow"
4. Select the package to publish (all, jalsp, or jalsp-cli)
5. Click run

## Local Testing

Before pushing, it's recommended to run the same commands locally:

```bash
# Install dependencies
pnpm install

# Lint check
pnpm lint

# Run tests
pnpm test

# Build
pnpm build
```

## Workspace Dependencies

This project uses pnpm workspaces. `jalsp-cli` depends on the `jalsp` package using the `workspace:*` protocol. When publishing:

- `jalsp` will be published first
- `jalsp-cli` will use the published version of `jalsp`

Ensure that both packages have their version numbers correctly updated before publishing.

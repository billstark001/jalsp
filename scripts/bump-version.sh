#!/bin/bash
# Version bump helper script
# Usage: ./scripts/bump-version.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "📦 Updating jalsp version..."
cd packages/jalsp
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version | sed 's/v//')
echo "✅ jalsp version updated to $NEW_VERSION"

cd ../../

echo "📦 Updating jalsp-cli version..."
cd packages/jalsp-cli
npm version $VERSION_TYPE --no-git-tag-version
echo "✅ jalsp-cli version updated to $NEW_VERSION"

cd ../../

echo ""
echo "🎉 Version update complete!"
echo ""
echo "Next steps:"
echo "1. Commit changes: git add . && git commit -m \"chore: bump version to $NEW_VERSION\""
echo "2. Create tag: git tag v$NEW_VERSION"
echo "3. Push code: git push && git push --tags"
echo "4. Create a Release on GitHub to trigger the publish workflow"

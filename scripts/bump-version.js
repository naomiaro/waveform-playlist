#!/usr/bin/env node

/**
 * Bump version across all packages in the monorepo
 *
 * Usage:
 *   pnpm version:bump 5.0.0-alpha.1
 *   pnpm version:bump patch         # 5.0.0-alpha.0 -> 5.0.1-alpha.0
 *   pnpm version:bump minor         # 5.0.0-alpha.0 -> 5.1.0-alpha.0
 *   pnpm version:bump major         # 5.0.0-alpha.0 -> 6.0.0-alpha.0
 *   pnpm version:bump prerelease    # 5.0.0-alpha.0 -> 5.0.0-alpha.1
 *
 * Filter specific packages:
 *   pnpm version:bump prerelease --filter browser
 *   pnpm version:bump prerelease --filter browser,core,playout
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const ROOT_PACKAGE = path.join(__dirname, '..', 'package.json');

// Parse command line args
function parseArgs(args) {
  let bump = null;
  let filter = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--filter' && args[i + 1]) {
      filter = args[i + 1].split(',').map(f => f.trim());
      i++;
    } else if (!bump && !args[i].startsWith('--')) {
      bump = args[i];
    }
  }

  return { bump, filter };
}

// Get all package.json files, optionally filtered
function getPackageJsonPaths(filter) {
  const packages = fs.readdirSync(PACKAGES_DIR);
  return packages
    .filter(pkg => {
      if (!filter) return true;
      return filter.includes(pkg);
    })
    .map(pkg => path.join(PACKAGES_DIR, pkg, 'package.json'))
    .filter(p => fs.existsSync(p));
}

// Parse version string
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

// Format version object to string
function formatVersion({ major, minor, patch, prerelease }) {
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

// Bump prerelease (alpha.0 -> alpha.1)
function bumpPrerelease(prerelease) {
  if (!prerelease) return 'alpha.0';
  const match = prerelease.match(/^(.+)\.(\d+)$/);
  if (match) {
    return `${match[1]}.${parseInt(match[2], 10) + 1}`;
  }
  return `${prerelease}.1`;
}

// Calculate new version
function calculateNewVersion(currentVersion, bump) {
  // If bump is a full version string, use it directly
  if (/^\d+\.\d+\.\d+/.test(bump)) {
    return bump;
  }

  const parsed = parseVersion(currentVersion);

  switch (bump) {
    case 'major':
      return formatVersion({
        major: parsed.major + 1,
        minor: 0,
        patch: 0,
        prerelease: parsed.prerelease,
      });
    case 'minor':
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor + 1,
        patch: 0,
        prerelease: parsed.prerelease,
      });
    case 'patch':
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch + 1,
        prerelease: parsed.prerelease,
      });
    case 'prerelease':
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch,
        prerelease: bumpPrerelease(parsed.prerelease),
      });
    default:
      throw new Error(`Unknown bump type: ${bump}. Use major, minor, patch, prerelease, or a version string.`);
  }
}

// Main
function main() {
  const { bump, filter } = parseArgs(process.argv.slice(2));

  if (!bump) {
    console.error('Usage: pnpm version:bump <major|minor|patch|prerelease|x.y.z> [--filter packages]');
    console.error('');
    console.error('Examples:');
    console.error('  pnpm version:bump prerelease              # all packages: 5.0.0-alpha.0 -> 5.0.0-alpha.1');
    console.error('  pnpm version:bump patch                   # all packages: 5.0.0-alpha.0 -> 5.0.1-alpha.0');
    console.error('  pnpm version:bump 5.0.0-beta.0            # all packages: set exact version');
    console.error('  pnpm version:bump prerelease --filter browser          # just browser package');
    console.error('  pnpm version:bump prerelease --filter browser,core     # multiple packages');
    process.exit(1);
  }

  // Get packages to update
  const packagePaths = getPackageJsonPaths(filter);

  if (packagePaths.length === 0) {
    console.error(`No packages found matching filter: ${filter.join(', ')}`);
    console.error('\nAvailable packages:');
    fs.readdirSync(PACKAGES_DIR).forEach(pkg => console.error(`  - ${pkg}`));
    process.exit(1);
  }

  // Read first package to get current version (for calculating new version)
  const firstPkg = JSON.parse(fs.readFileSync(packagePaths[0], 'utf8'));
  const currentVersion = firstPkg.version;
  const newVersion = calculateNewVersion(currentVersion, bump);

  const scope = filter ? filter.join(', ') : 'all packages';
  console.log(`Bumping ${scope}: ${currentVersion} -> ${newVersion}\n`);

  // Update root package.json only if no filter (bumping all)
  if (!filter) {
    const rootPkg = JSON.parse(fs.readFileSync(ROOT_PACKAGE, 'utf8'));
    rootPkg.version = newVersion;
    fs.writeFileSync(ROOT_PACKAGE, JSON.stringify(rootPkg, null, 2) + '\n');
    console.log(`  Updated: package.json`);
  }

  // Update package.json files
  for (const pkgPath of packagePaths) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  Updated: ${path.relative(path.join(__dirname, '..'), pkgPath)}`);
  }

  console.log(`\nDone! ${filter ? 'Selected packages' : 'All packages'} updated to ${newVersion}`);
  console.log('\nNext steps:');
  console.log('  1. git add -A');
  console.log(`  2. git commit -m "chore: bump ${filter ? filter.join(', ') : 'version'} to ${newVersion}"`);
  console.log('  3. git push');
}

main();

// Release helper.
//   node scripts/release.mjs bump patch|minor|major   -> bumps package.json, rolls CHANGELOG, commits
//   node scripts/release.mjs notes <version>          -> prints that version's CHANGELOG section (used by CI)
// The git tag itself is created automatically (.github/workflows/release.yml) when the bump is merged to main.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [cmd, arg] = process.argv.slice(2);
const pkgUrl = new URL('../package.json', import.meta.url);
const logUrl = new URL('../CHANGELOG.md', import.meta.url);

function sh(c) {
  return execSync(c, { encoding: 'utf8' }).trim();
}

function section(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join('\n').trim();
}

if (cmd === 'notes') {
  const notes = section(readFileSync(logUrl, 'utf8'), arg);
  console.log(notes || `Release ${arg}`);
} else if (cmd === 'bump') {
  if (!['patch', 'minor', 'major'].includes(arg)) {
    console.error('Usage: npm run release -- bump patch|minor|major');
    process.exit(1);
  }
  if (sh('git status --porcelain')) {
    console.error('Your working tree has uncommitted changes. Commit or stash them first.');
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
  const [maj, min, pat] = pkg.version.split('.').map(Number);
  const next = arg === 'major' ? `${maj + 1}.0.0` : arg === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
  pkg.version = next;
  writeFileSync(pkgUrl, JSON.stringify(pkg, null, 2) + '\n');

  const lock = new URL('../package-lock.json', import.meta.url);
  try {
    const l = JSON.parse(readFileSync(lock, 'utf8'));
    l.version = next;
    if (l.packages?.['']) l.packages[''].version = next;
    writeFileSync(lock, JSON.stringify(l, null, 2) + '\n');
  } catch {
    /* no lockfile */
  }

  let log = readFileSync(logUrl, 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  if (!log.includes('## [Unreleased]')) {
    console.error('CHANGELOG.md needs a "## [Unreleased]" section with this release\'s notes.');
    process.exit(1);
  }
  log = log.replace('## [Unreleased]', `## [Unreleased]\n\n## [${next}] - ${date}`);
  writeFileSync(logUrl, log);

  sh(`git add package.json CHANGELOG.md ${'package-lock.json'}`);
  sh(`git commit -m "Release v${next}"`);
  console.log(`Bumped to ${next} and committed. Open a pull request; when it is merged to main, v${next} is tagged automatically.`);
} else {
  console.error('Usage: node scripts/release.mjs bump <patch|minor|major> | notes <version>');
  process.exit(1);
}

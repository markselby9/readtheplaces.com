import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { type BuildStamp, compareBuild } from './freshness.ts';

/**
 * Is production serving this commit?
 *
 *   bun run check-deploy                     against readtheplaces.com
 *   bun run check-deploy http://localhost:4321   against a local preview
 *
 * Exits non-zero when the live build is behind, so a scheduled workflow can shout
 * about a deploy that silently never happened. See freshness.ts for why.
 */

const BOOKS = new URL('../../../books/', import.meta.url);
const SITE = process.argv[2] ?? 'https://readtheplaces.com';

/** The count the build will glob: one book per books/<slug>/book.json. */
function bookCount(): number {
  return readdirSync(BOOKS).filter((s) => existsSync(new URL(`${s}/book.json`, BOOKS))).length;
}

/**
 * The commit production should be serving.
 *
 * origin/main, not HEAD: the site deploys from main, so a local branch or an
 * unpushed commit is not something prod is expected to have. Falls back to HEAD
 * when there is no remote ref, which is the case in a fresh shallow clone.
 */
function expectedCommit(): string {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  try {
    return git('rev-parse', 'origin/main');
  } catch {
    return git('rev-parse', 'HEAD');
  }
}

async function liveStamp(): Promise<BuildStamp | null> {
  const res = await fetch(`${SITE}/build-info.json`, { headers: { 'cache-control': 'no-cache' } });
  // A 404 is the expected answer from any build predating the stamp, and it is a
  // real result rather than an error: that build is definitionally not current.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${SITE}/build-info.json returned ${res.status}`);
  return (await res.json()) as BuildStamp;
}

const expected = { commit: expectedCommit(), books: bookCount() };
const live = await liveStamp();
const { fresh, reasons } = compareBuild(expected, live);

if (fresh) {
  console.log(`${SITE} is current: ${expected.books} books at ${expected.commit.slice(0, 7)}.`);
  process.exit(0);
}

console.error(`${SITE} is not serving the current build:`);
for (const r of reasons) console.error(`  - ${r}`);
console.error(
  "\nThe site deploys from Cloudflare's git-connected build, not from CI, so check\n" +
    'the Builds tab for the readtheplaces-com Worker: the build either failed, never\n' +
    'triggered, or is still running. See docs/DESIGN.md.',
);
process.exit(1);

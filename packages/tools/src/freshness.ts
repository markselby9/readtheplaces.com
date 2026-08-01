/**
 * Is the live site built from the commit we think it is?
 *
 * The book count on the homepage is computed at build time from books/*\/book.json,
 * so it is only ever as current as the last successful deploy. Production once
 * served a build from the previous commit for over an hour, reading "392 books"
 * against a repo holding 427, and nothing in the system noticed: CI was green,
 * the data was valid, and the deploy is Cloudflare's own git-connected build,
 * which reports to its dashboard and not to us.
 *
 * So the site stamps what it built (apps/web/src/pages/build-info.json.ts) and
 * this compares that stamp against the repo. Kept separate from the CLI so it can
 * be tested; check-deploy.ts is the runnable half.
 */

export interface BuildStamp {
  /** The commit the build came from, or 'unknown' outside Cloudflare's builder. */
  commit: string;
  /** Books the build rendered, i.e. how many books/*\/book.json it globbed. */
  books: number;
  builtAt: string;
}

export interface Freshness {
  fresh: boolean;
  /** One line per mismatch, in the order found. Empty when fresh. */
  reasons: string[];
}

const short = (sha: string) => sha.slice(0, 7);

/**
 * Compare the repo against the live stamp.
 *
 * Reports every mismatch rather than the first, because "behind by a commit" and
 * "short by 35 books" are separate facts and the second is the one a human reads.
 */
export function compareBuild(
  expected: { commit: string; books: number },
  live: BuildStamp | null,
): Freshness {
  // A build with no stamp predates this check, which is itself proof it is not
  // the current build.
  if (!live) return { fresh: false, reasons: ['no build stamp on the live site'] };

  const reasons: string[] = [];

  // Only Cloudflare's builder is told the commit. A local build honestly says so,
  // and an honest 'unknown' is not a mismatch — the count still holds it to account.
  if (live.commit !== 'unknown' && live.commit !== expected.commit) {
    reasons.push(
      `live build is commit ${short(live.commit)}, the repo is at ${short(expected.commit)}`,
    );
  }

  if (live.books !== expected.books) {
    reasons.push(`live build has ${live.books} books, the repo has ${expected.books}`);
  }

  return { fresh: reasons.length === 0, reasons };
}

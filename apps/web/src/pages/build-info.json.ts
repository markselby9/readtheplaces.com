import type { APIRoute } from 'astro';
import { allBooks, isStub } from '../lib/books';

/**
 * What this build actually contains, served as JSON.
 *
 * Every count on the site is computed at build time from books/*\/book.json, so
 * the site is only as current as its last deploy — and because production ships
 * via Cloudflare's git-connected build, a deploy that never ran leaves no trace
 * here. It happened: prod served the previous commit for over an hour, saying
 * "392 books" against a repo holding 427, with CI green the whole time.
 *
 * This makes that state answerable over HTTP instead of by eye. `bun run
 * check-deploy` compares it against the repo; see packages/tools/src/freshness.ts.
 */

/** Cloudflare Workers Builds injects the commit; a local build has no idea. */
const commit = process.env.WORKERS_CI_COMMIT_SHA ?? 'unknown';

export const GET: APIRoute = async () => {
  const books = await allBooks();

  return new Response(
    `${JSON.stringify(
      {
        commit,
        // Books globbed, which is the number comparable to the repo's file count.
        // `mapped` is what the homepage displays, and the two differ the moment a
        // book is listed without waypoints, so report both.
        books: books.length,
        mapped: books.filter((b) => !isStub(b)).length,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};

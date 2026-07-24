# Security

## Reporting

Report vulnerabilities privately via GitHub's ["Report a vulnerability"](../../security/advisories/new) form. Please do not open a public issue.

We will acknowledge within a week.

## Scope

This is a static site with no accounts, no user data, and no database. The
realistic surface is small, but not empty:

- **The auto-PR bot** (`infra/pr-bot`) — _planned, not yet built_ — will accept
  input from unauthenticated strangers and open pull requests with it. Injection
  into PR bodies, branch names, or file paths will be in scope and interesting
  once it exists. Until then, contribution is git-based and every data PR is
  reviewed by a human.
- **Book data is user-authored.** Waypoint notes and passages render as HTML.
  Anything that gets stored XSS past the schema is in scope.
- **Tile and geocoding endpoints** are third-party URLs held in `book.json`. A
  malicious tile URL in a data PR is a real path; that is one reason data PRs get
  human review and not just CI.

## Not in scope

- Rate limits on public tile providers (we cache; be a good citizen).
- The public-domain novels in `books/*/source.txt`.

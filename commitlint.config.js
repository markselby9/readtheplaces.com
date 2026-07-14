/**
 * Conventional Commits, enforced by a git hook (lefthook) and again in CI.
 *
 * The history is a public artefact of this project. It should read like a
 * changelog, and it should be possible to tell from a subject line whether a
 * commit touched the software or the books, because those are reviewed by
 * different people.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // a new capability
        'fix', // a bug fix
        'data', // book data: waypoints, a new book, a historical layer
        'docs',
        'style', // formatting only, no behaviour change
        'refactor',
        'perf',
        'test',
        'build', // build system, dependencies
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'schema', // packages/schema, the contract
        'tools', // packages/tools: plates, extract, new-book
        'web', // apps/web
        'reader', // the Svelte island
        'books', // a specific book's data
        'seo',
        'a11y',
        'deps',
        'repo', // meta: licence, templates, workflows
        '', // scope is optional
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 80],
  },
};

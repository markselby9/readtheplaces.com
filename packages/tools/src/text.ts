/**
 * Turning a published edition into the text every quote is checked against.
 *
 * Kept separate from the CLI so it can be tested. `new-book.ts` runs on import,
 * so anything importable has to live here.
 */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface Edition {
  path: string;
  translator: string | null;
}

/**
 * Find the book on Standard Ebooks.
 *
 * We search rather than guess the URL, because translated works are nested under
 * the translator: Crime and Punishment lives at
 * /ebooks/fyodor-dostoevsky/crime-and-punishment/constance-garnett, and any
 * guess at /author/title alone would 404. Since most of the books this project
 * wants are translations, guessing would fail for most of them.
 *
 * The translator matters beyond routing. The work and the translation are
 * separate rights objects, and quotes are checked against the translation, so
 * the edition has to be recorded.
 */
export async function findOnStandardEbooks(title: string, author: string): Promise<Edition | null> {
  const q = new URLSearchParams({ query: `${title} ${author}` });
  try {
    const res = await fetch(`https://standardebooks.org/ebooks?${q}`, {
      headers: { 'User-Agent': 'readtheplaces-new-book/1.0 (https://readtheplaces.com)' },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const wantAuthor = slugify(author);
    const wantTitle = slugify(title);

    const paths = [
      ...new Set(
        [...html.matchAll(/href="(\/ebooks\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)"/g)].map(
          (m) => m[1]!,
        ),
      ),
    ];

    const match = paths.find((p) => {
      const [, , a, t] = p.split('/');
      return a === wantAuthor && t === wantTitle;
    });
    if (!match) return null;

    // A search hit is not proof the book exists. Standard Ebooks lists titles it
    // wants but has not produced, and titles still under copyright until a future
    // year, at the same /author/title URL. Those pages carry no download links;
    // only a produced ebook does. Require one, or we would list a book with no
    // text behind it (this is how The Master and Margarita slipped in).
    if (!(await isProducedEbook(match))) return null;

    const parts = match.split('/');
    return { path: match, translator: parts[4] ?? null };
  } catch {
    return null;
  }
}

async function isProducedEbook(path: string): Promise<boolean> {
  try {
    const res = await fetch(`https://standardebooks.org${path}`, {
      headers: { 'User-Agent': 'readtheplaces-new-book/1.0 (https://readtheplaces.com)' },
    });
    if (!res.ok) return false;
    return /href="[^"]+\.epub"/i.test(await res.text());
  } catch {
    return false;
  }
}

export async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://standardebooks.org${path}/text/single-page`, {
      headers: { 'User-Agent': 'readtheplaces-new-book/1.0 (https://readtheplaces.com)' },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** "constance-garnett" reads badly in a rights block. */
export function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Reduce the Standard Ebooks page to the novel itself.
 *
 * The single-page HTML wraps the text in a title page, an imprint, sometimes a
 * preface, and a colophon and licence at the end. All of it is prose, none of it
 * is the novel. Left in, it does real damage:
 *
 *   - every `position` is skewed, because position is an offset into this text;
 *   - a quote anchor could match Standard Ebooks' boilerplate instead of the
 *     novel and still pass the build.
 *
 * Standard Ebooks marks structure semantically, so we can cut exactly rather
 * than guess: keep only `epub:type="bodymatter"`.
 */
function extractBodyMatter(html: string): string {
  // Slice, do not match. Chapters are sections nested inside the part sections,
  // so a non-greedy <section>…</section> match stops at the first nested close
  // and silently keeps one chapter per part. That produced 185k characters of
  // Crime and Punishment instead of 1.1M, and every position would have been
  // wrong.
  const first = html.search(/<section[^>]*epub:type="[^"]*bodymatter[^"]*"/);
  if (first === -1) {
    // Not Standard Ebooks markup. Use the whole document and let the contributor
    // trim it.
    return html
      .replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, ' ');
  }

  const backmatter = html.search(/<section[^>]*epub:type="[^"]*backmatter[^"]*"/);
  const end = backmatter > first ? backmatter : html.length;

  return html
    .slice(first, end)
    .replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

/** Strip HTML to the prose, so quote anchors match what a reader sees. */
export function toPlainText(html: string): string {
  return extractBodyMatter(html)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

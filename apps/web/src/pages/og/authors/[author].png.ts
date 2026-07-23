import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { accentOf, allBooks, isStub } from '../../../lib/books';
import { byAuthor } from '../../../lib/facets';

/** Author hubs are a share surface too. Give them the same branded card as
 *  books so a shared "/authors/…" link previews as an image, not bare text. */

export async function getStaticPaths() {
  const books = await allBooks();
  return byAuthor(books).map((f) => ({ params: { author: f.slug } }));
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ params }) => {
  const facet = byAuthor(await allBooks()).find((f) => f.slug === params.author);
  if (!facet) return new Response('Not found', { status: 404 });

  const { label, books } = facet;
  const mapped = books.filter((b) => !isStub(b));
  const places = mapped.reduce((n, b) => n + b.waypoints.length, 0);
  const accent = accentOf((mapped[0] ?? books[0]!).book);
  const subtitle =
    places > 0
      ? `${places} real places across ${books.length} book${books.length === 1 ? '' : 's'}`
      : 'Listed and open for adoption';

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F5F2EA"/>
  <rect x="0" y="0" width="10" height="630" fill="${accent}"/>
  <text x="80" y="118" font-family="Helvetica,Arial,sans-serif" font-size="22" font-weight="700"
        letter-spacing="5" fill="#857D70">READ THE PLACES</text>
  <text x="80" y="262" font-family="Georgia,serif" font-size="76" fill="#1B1917">Books by</text>
  <text x="80" y="360" font-family="Georgia,serif" font-size="80" font-style="italic" fill="#1B1917">${escapeXml(label)}</text>
  <line x1="80" y1="428" x2="1120" y2="428" stroke="#D9D2C4" stroke-width="1"/>
  <text x="80" y="486" font-family="Georgia,serif" font-size="30" fill="#4A453D">${escapeXml(subtitle)}</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
};

import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { accentOf, allBooks, loadBook } from '../../lib/books';

/** Every walk gets a link-preview card. The project grows through shared walks,
 *  so a bare URL in a chat window is a wasted impression. */

export async function getStaticPaths() {
  const books = await allBooks();
  return books.map(({ slug }) => ({ params: { book: slug } }));
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ params }) => {
  const { book, waypoints } = await loadBook(params.book!);

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F5F2EA"/>
  <rect x="0" y="0" width="10" height="630" fill="${accentOf(book)}"/>
  <text x="80" y="118" font-family="Helvetica,Arial,sans-serif" font-size="22" font-weight="700"
        letter-spacing="5" fill="#857D70">READ THE PLACES</text>
  <text x="80" y="262" font-family="Georgia,serif" font-size="76" fill="#1B1917">The ${escapeXml(book.setting.city)} of</text>
  <text x="80" y="360" font-family="Georgia,serif" font-size="80" font-style="italic" fill="#1B1917">${escapeXml(book.title)}</text>
  <line x1="80" y1="428" x2="1120" y2="428" stroke="#D9D2C4" stroke-width="1"/>
  <text x="80" y="486" font-family="Georgia,serif" font-size="30" fill="#4A453D">${
    waypoints.length > 0
      ? `${waypoints.length} places, in the order the story visits them`
      : 'Open for adoption. Be the first to map it.'
  }</text>
  <text x="80" y="556" font-family="Helvetica,Arial,sans-serif" font-size="24" fill="#857D70">${escapeXml(book.author)}, ${book.published ?? ''}</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
};

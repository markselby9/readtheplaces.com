/** WCAG 2.1 relative luminance and contrast ratio. */

/** --paper, the background everything is set on. */
export const PAPER: readonly [number, number, number] = [0xf5, 0xf2, 0xea];

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast of a hex colour against a background, default paper.
 *
 * Character names and the accent are set as text, so they must be legible. This
 * caught Peter Walsh's first ochre at 3.54:1, which fails AA.
 */
export function contrast(hex: string, bg: readonly [number, number, number] = PAPER): number {
  const h = hex.replace('#', '');
  const fg: [number, number, number] = [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

import sharp from 'sharp';

/**
 * Compose static map images from raster tiles.
 *
 * The walk page cannot use live maps: browsers cap simultaneous WebGL contexts
 * at about sixteen, and fifteen stops across two eras needs thirty-one. Measured
 * on the prototype, sixteen lived and fifteen came back as dead canvases.
 *
 * Images are better here anyway. The page that must be indexed and shared ships
 * no JavaScript, `<img>` brings lazy-loading and intrinsic sizing for free,
 * nothing shifts on load, and no map ever fails to paint.
 */

export const TILE = 256;

/** Slippy-map tile coordinates, fractional so the centre can land mid-tile. */
export function deg2num(lat: number, lon: number, z: number): [number, number] {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return [x, y];
}

export function tileUrl(template: string, z: number, x: number, y: number, retina: boolean): string {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', retina ? '@2x' : '');
}

async function fetchTile(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'readtheplaces-plates/1.0' } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export interface PlateOptions {
  lat: number;
  lon: number;
  zoom: number;
  width: number;
  height: number;
  template: string;
  /** Retina. Tiles are requested at @2x where the provider supports it. */
  retina?: boolean;
  /**
   * Ink on warm paper. Default OSM styling (blue water, yellow motorways, green
   * parks) fights the page on every tile. Filtered down, the only colour in the
   * frame comes from the historical survey and the character pin.
   */
  ink?: boolean;
  /** Hex colour of the waypoint's character. */
  pin?: string;
}

export async function renderPlate(o: PlateOptions): Promise<Buffer> {
  const retina = o.retina ?? true;
  const scale = retina ? 2 : 1;
  const W = o.width * scale;
  const H = o.height * scale;
  const tsize = TILE * scale;

  const [cx, cy] = deg2num(o.lat, o.lon, o.zoom);
  const x0 = cx * tsize - W / 2;
  const y0 = cy * tsize - H / 2;

  const tx0 = Math.floor(x0 / tsize);
  const ty0 = Math.floor(y0 / tsize);
  const tx1 = Math.floor((x0 + W) / tsize);
  const ty1 = Math.floor((y0 + H) / tsize);

  const requests: Promise<{ buf: Buffer | null; left: number; top: number }>[] = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const url = tileUrl(o.template, o.zoom, tx, ty, retina);
      requests.push(
        fetchTile(url).then((buf) => ({
          buf,
          left: Math.round(tx * tsize - x0),
          top: Math.round(ty * tsize - y0),
        })),
      );
    }
  }

  const fetched = await Promise.all(requests);
  const layers = await Promise.all(
    fetched
      .filter((t): t is { buf: Buffer; left: number; top: number } => t.buf !== null)
      .map(async (t) => ({
        input: await sharp(t.buf).resize(tsize, tsize, { fit: 'fill' }).png().toBuffer(),
        left: t.left,
        top: t.top,
      })),
  );

  if (layers.length === 0) {
    throw new Error(`No tiles returned for ${o.template} at ${o.lat},${o.lon} z${o.zoom}`);
  }

  let buf = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 245, g: 242, b: 234, alpha: 1 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();

  if (o.ink) {
    buf = await sharp(buf)
      .greyscale()
      .linear(0.86, 26) // lift the blacks toward paper, flatten contrast
      .tint({ r: 252, g: 249, b: 242 })
      .png()
      .toBuffer();
  }

  if (o.pin) {
    const r = 7 * scale;
    const marker = Buffer.from(
      `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
         <circle cx="${W / 2}" cy="${H / 2}" r="${r + 2.5 * scale}" fill="#F5F2EA"/>
         <circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="${o.pin}"/>
       </svg>`,
    );
    buf = await sharp(buf).composite([{ input: marker }]).png().toBuffer();
  }

  return sharp(buf).webp({ quality: 82, effort: 6 }).toBuffer();
}

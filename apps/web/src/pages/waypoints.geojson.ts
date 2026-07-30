import type { APIRoute } from 'astro';
import { waypointsFeatureCollection } from '../lib/atlas';
import { allBooks } from '../lib/books';

// A single static asset: every waypoint in the corpus as GeoJSON. The all-places
// map at /map loads this as one clustered source. Built once, served as a file.
export const prerender = true;

export const GET: APIRoute = async () => {
  const fc = waypointsFeatureCollection(await allBooks());
  return new Response(JSON.stringify(fc), {
    headers: { 'content-type': 'application/geo+json; charset=utf-8' },
  });
};

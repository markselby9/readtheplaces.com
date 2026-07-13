/**
 * Google is a hyperlink, never an embed.
 *
 * Google Maps Platform ToS §3.2.3(e), "No Use With Non-Google Maps", forbids
 * displaying "Street View imagery and non-Google Maps on the same screen". An
 * embedded panorama beside our OpenStreetMap basemap is named, explicitly, as
 * prohibited.
 *
 * A plain link to google.com/maps is not a Maps Platform API call. No key, no
 * SDK, no agreement, no clause. So we get Street View's worldwide coverage
 * without surrendering the open stack, and without forcing every contributor to
 * create a billed Google Cloud project just to run the repo.
 */

type Coords = readonly [number, number];

/**
 * Street View has holes: no mainland China, partial India. So Maps is the link
 * every stop always gets, and Street View is offered on top of it.
 */
export const googleMaps = ([lon, lat]: Coords): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

export const streetView = ([lon, lat]: Coords): string =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

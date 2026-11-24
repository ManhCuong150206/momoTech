export interface Coordinates {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(from: Coordinates, to: Coordinates): number {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const latDifference = toRadians(to.lat - from.lat);
  const lonDifference = toRadians(to.lon - from.lon);

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDifference / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

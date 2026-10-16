// Shared browser/server geometry. Exact fixes are converted on-device only.
// Latitude bands are ~2.22 km high; longitude sectors are ~2.22 km wide
// at the band centre. This avoids Web Mercator distortion near the poles.
export const NEARBY_RADII = Object.freeze(Array.from({ length: 38 }, (_, index) => index + 5));
export const NEARBY_TTL_MS = 90_000;
export const NEARBY_REFRESH_MS = 30_000;
export const NEARBY_MAX_RESULTS = 20;
const BANDS = 9000;
const RAD = Math.PI / 180;
const EARTH_KM = 6371;
const bandLatitude = band => -90 + ((band + 0.5) * 180) / BANDS;
const sectors = band => Math.max(1, Math.round(18000 * Math.cos(bandLatitude(band) * RAD)));

export function coarseNearbyCell(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const band = Math.min(BANDS - 1, Math.floor(((latitude + 90) / 180) * BANDS));
  const sector = Math.floor((((longitude + 180) % 360) / 360) * sectors(band));
  return `n2:${band}:${sector}`;
}

export function parseNearbyCell(cell) {
  if (typeof cell !== 'string' || cell.length > 18 || !/^n2:(0|[1-9]\d{0,3}):(0|[1-9]\d{0,4})$/.test(cell)) return null;
  const [, band, sector] = cell.split(':').map(Number);
  if (band >= BANDS || sector >= sectors(band)) return null;
  return { band, sector };
}

export function nearbyCellDistanceKm(a, b) {
  const first = parseNearbyCell(a);
  const second = parseNearbyCell(b);
  if (!first || !second) return Infinity;
  const lat1 = bandLatitude(first.band) * RAD;
  const lat2 = bandLatitude(second.band) * RAD;
  const lon1 = ((first.sector + 0.5) / sectors(first.band)) * 2 * Math.PI;
  const lon2 = ((second.sector + 0.5) / sectors(second.band)) * 2 * Math.PI;
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function validNearbyArea(value) {
  return (
    exactKeys(value, ['schemaVersion', 'cell', 'radiusKm']) &&
    value.schemaVersion === 2 &&
    parseNearbyCell(value.cell) !== null &&
    NEARBY_RADII.includes(value.radiusKm)
  );
}

export function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key))
  );
}

export function nearbyAreasMatch(host, listener) {
  return validNearbyArea(host) && validNearbyArea(listener) && nearbyCellDistanceKm(host.cell, listener.cell) <= Math.min(host.radiusKm, listener.radiusKm);
}

export function nearbyBucket(count) {
  return count === 0 ? '0' : count < 4 ? '1–3' : count < 10 ? '4–9' : '10+';
}

// Worldwide publication is a separate explicit consent, with no geographic data.
export function validWorldwideArea(value) {
  return exactKeys(value, ['schemaVersion', 'worldwide']) && value.schemaVersion === 2 && value.worldwide === true;
}

// Distance-aware reads are opt-in v3. Existing v2 clients keep their exact
// response shape. Publication remains v2 and never reveals the host cell.
export function validDiscoverySearch(value) {
  if (validNearbyArea(value) || validWorldwideArea(value)) return true;
  if (!value || value.schemaVersion !== 3) return false;
  return validNearbyArea({ ...value, schemaVersion: 2 }) || validWorldwideArea({ ...value, schemaVersion: 2 });
}
export function nearbyDistanceBand(a, b) {
  const distance = nearbyCellDistanceKm(a, b);
  if (!Number.isFinite(distance) || distance > 42) return null;
  const lower = Math.min(40, Math.floor(distance / 5) * 5);
  return `${lower}–${lower + 5} km`;
}

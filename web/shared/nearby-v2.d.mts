export type NearbyArea = { schemaVersion: 2; cell: string; radiusKm: number };
export const NEARBY_RADII: readonly number[];
export const NEARBY_TTL_MS: number;
export const NEARBY_REFRESH_MS: number;
export const NEARBY_MAX_RESULTS: number;
export function coarseNearbyCell(latitude: number, longitude: number): string | null;
export function parseNearbyCell(cell: unknown): { band: number; sector: number } | null;
export function nearbyCellDistanceKm(a: string, b: string): number;
export function validNearbyArea(value: unknown): value is NearbyArea;
export function exactKeys(value: unknown, keys: string[]): boolean;
export function nearbyAreasMatch(host: NearbyArea, listener: NearbyArea): boolean;
export function nearbyBucket(count: number): string;

export type WorldwideArea = { schemaVersion: 2; worldwide: true };
export function validWorldwideArea(value: unknown): value is WorldwideArea;

export type DiscoverySearchArea = NearbyArea | WorldwideArea | { schemaVersion: 3; cell: string; radiusKm: number } | { schemaVersion: 3; worldwide: true };
export function validDiscoverySearch(value: unknown): value is DiscoverySearchArea;
export function nearbyDistanceBand(a: string, b: string): string | null;

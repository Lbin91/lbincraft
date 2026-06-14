/**
 * Math utilities for voxel coordinate calculations.
 */

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

/** Convert local block coords to array index: x + z*16 + y*256 */
export function blockIndex(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

/** Convert world X to chunk X */
export function worldToChunk(wx: number): number {
    return Math.floor(wx / CHUNK_SIZE);
}

/** Convert world X to local chunk X (0-15) */
export function worldToLocal(wx: number): number {
    return ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

/** Generate chunk map key string */
export function chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
}

/** Clamp value to range */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** World boundary limits */
export const WORLD_BOUNDARY = 10000;

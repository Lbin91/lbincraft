/**
 * Terrain generator using simplex-noise (v4 API).
 * Multi-octave fractal Brownian motion (fBm) for natural terrain.
 */

import { createNoise2D } from 'simplex-noise';
import { Chunk } from './Chunk';
import { BlockId } from '../blocks/BlockType';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../utils/math';

// Terrain configuration
const BASE_HEIGHT = 28;
const AMPLITUDE = 16;
const WATER_LEVEL = 24;

// Noise frequencies per octave
const FREQ_MAIN = 0.012;
const FREQ_DETAIL = 0.04;
const FREQ_ROUGH = 0.1;

export class TerrainGenerator {
    private noise2D: (x: number, y: number) => number;

    constructor(seed?: number) {
        // simplex-noise v4: createNoise2D with optional PRNG
        if (seed !== undefined) {
            // Simple seeded PRNG (mulberry32)
            const prng = mulberry32(seed);
            this.noise2D = createNoise2D(prng);
        } else {
            this.noise2D = createNoise2D();
        }
    }

    /** Fractal Brownian Motion - stack multiple noise octaves */
    private fBm(x: number, z: number): number {
        let height = BASE_HEIGHT;
        height += this.noise2D(x * FREQ_MAIN, z * FREQ_MAIN) * AMPLITUDE;
        height += this.noise2D(x * FREQ_DETAIL, z * FREQ_DETAIL) * AMPLITUDE * 0.35;
        height += this.noise2D(x * FREQ_ROUGH, z * FREQ_ROUGH) * AMPLITUDE * 0.12;
        return Math.floor(height);
    }

    /** Generate terrain for a chunk */
    generateChunk(chunk: Chunk): void {
        const worldOffsetX = chunk.cx * CHUNK_SIZE;
        const worldOffsetZ = chunk.cz * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = worldOffsetX + x;
                const wz = worldOffsetZ + z;
                const height = this.fBm(wx, wz);

                for (let y = 0; y <= Math.max(height, WATER_LEVEL); y++) {
                    let blockId: BlockId;

                    if (y === 0) {
                        blockId = BlockId.Bedrock;
                    } else if (y > height) {
                        // Above terrain - fill with water up to water level
                        if (y <= WATER_LEVEL) {
                            blockId = BlockId.Water;
                        } else {
                            continue; // Air (skip)
                        }
                    } else if (y === height) {
                        // Surface block
                        if (height <= WATER_LEVEL + 1) {
                            blockId = BlockId.Sand; // Beaches near water
                        } else {
                            blockId = BlockId.Grass;
                        }
                    } else if (y > height - 3) {
                        blockId = BlockId.Dirt;
                    } else {
                        blockId = BlockId.Stone;
                    }

                    chunk.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = blockId;
                }

                // Generate trees on grass surfaces (low probability)
                if (height > WATER_LEVEL + 1 && height < CHUNK_HEIGHT - 8) {
                    // Deterministic pseudo-random based on world coords
                    const hash = ((wx * 374761393) ^ (wz * 668265263)) >>> 0;
                    if (hash % 60 === 0 && chunk.blocks[height * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] === BlockId.Grass) {
                        this.generateTree(chunk, x, height + 1, z);
                    }
                }
            }
        }

        chunk.generated = true;
    }

    /** Generate a simple tree at local coordinates */
    private generateTree(chunk: Chunk, x: number, y: number, z: number): void {
        const trunkHeight = 4 + ((x + z) % 3); // 4-6 blocks

        // Trunk
        for (let i = 0; i < trunkHeight; i++) {
            if (y + i < CHUNK_HEIGHT) {
                chunk.blocks[(y + i) * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = BlockId.Wood;
            }
        }

        // Leaves (sphere-ish canopy)
        const topY = y + trunkHeight;
        for (let dy = -1; dy <= 2; dy++) {
            const radius = dy <= 0 ? 2 : 1;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0 && dy < 2) continue; // Don't overwrite trunk
                    const lx = x + dx;
                    const ly = topY + dy;
                    const lz = z + dz;
                    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
                        const idx = ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
                        if (chunk.blocks[idx] === BlockId.Air) {
                            // Only place leaves on corners if on outer ring
                            if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
                                if ((x + z + dy) % 2 === 0) {
                                    chunk.blocks[idx] = BlockId.Leaves;
                                }
                            } else {
                                chunk.blocks[idx] = BlockId.Leaves;
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Seeded PRNG (mulberry32) for deterministic terrain */
function mulberry32(seed: number): () => number {
    let a = seed;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

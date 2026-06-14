/**
 * Terrain generator using simplex-noise (v4 API).
 * Multi-octave fractal Brownian motion (fBm) for natural terrain.
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { Chunk } from './Chunk';
import { BlockId } from '../blocks/BlockType';
import { BiomeId as _BiomeId, BIOME_PARAMS, getBiomeId, BiomeParams } from './BiomeType';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../utils/math';

const WATER_LEVEL = 24;
const FREQ_MAIN = 0.012;
const FREQ_DETAIL = 0.04;
const FREQ_ROUGH = 0.1;
const CAVE_THRESHOLD = 0.6;
const CAVE_MAX_HEIGHT = 28;
const CAVE_NOISE_FREQ = 0.05;
const BIOME_SAMPLE_SIZE = 16;

export class TerrainGenerator {
    private noise2D: (x: number, y: number) => number;
    private caveNoise3D: (x: number, y: number, z: number) => number;
    private tempNoise: (x: number, y: number) => number;
    private humidNoise: (x: number, y: number) => number;

    constructor(seed?: number) {
        if (seed !== undefined) {
            const prng = mulberry32(seed);
            const prngCaves = mulberry32(seed ^ 0x5a5a5a);
            const prngTemp = mulberry32(seed ^ 0xa3a3a3);
            const prngHumid = mulberry32(seed ^ 0x1b1b1b);
            this.noise2D = createNoise2D(prng);
            this.caveNoise3D = createNoise3D(prngCaves);
            this.tempNoise = createNoise2D(prngTemp);
            this.humidNoise = createNoise2D(prngHumid);
        } else {
            this.noise2D = createNoise2D();
            this.caveNoise3D = createNoise3D();
            this.tempNoise = createNoise2D();
            this.humidNoise = createNoise2D();
        }
    }

    private fBm(x: number, z: number, baseHeight: number, amplitude: number): number {
        let height = baseHeight;
        height += this.noise2D(x * FREQ_MAIN, z * FREQ_MAIN) * amplitude;
        height += this.noise2D(x * FREQ_DETAIL, z * FREQ_DETAIL) * amplitude * 0.35;
        height += this.noise2D(x * FREQ_ROUGH, z * FREQ_ROUGH) * amplitude * 0.12;
        return Math.floor(height);
    }

    private getBlendedParams(wx: number, wz: number): BiomeParams {
        const sx = Math.floor(wx / BIOME_SAMPLE_SIZE) * BIOME_SAMPLE_SIZE;
        const sz = Math.floor(wz / BIOME_SAMPLE_SIZE) * BIOME_SAMPLE_SIZE;
        const fx = (wx - sx) / BIOME_SAMPLE_SIZE;
        const fz = (wz - sz) / BIOME_SAMPLE_SIZE;

        const samples = [
            { x: sx, z: sz, weight: (1 - fx) * (1 - fz) },
            { x: sx + BIOME_SAMPLE_SIZE, z: sz, weight: fx * (1 - fz) },
            { x: sx, z: sz + BIOME_SAMPLE_SIZE, weight: (1 - fx) * fz },
            { x: sx + BIOME_SAMPLE_SIZE, z: sz + BIOME_SAMPLE_SIZE, weight: fx * fz },
        ];

        let baseHeight = 0;
        let amplitude = 0;
        let treeDensity = 0;
        let bestWeight = 0;
        let surfaceBlock = BlockId.Grass;
        let subsurfaceBlock = BlockId.Dirt;

        for (const s of samples) {
            const temp = this.tempNoise(s.x * 0.003, s.z * 0.003);
            const humid = this.humidNoise(s.x * 0.004 + 100, s.z * 0.004 + 100);
            const biomeId = getBiomeId(temp, humid);
            const params = BIOME_PARAMS[biomeId];

            baseHeight += params.baseHeight * s.weight;
            amplitude += params.amplitude * s.weight;
            treeDensity += params.treeDensity * s.weight;

            if (s.weight > bestWeight) {
                bestWeight = s.weight;
                surfaceBlock = params.surfaceBlock;
                subsurfaceBlock = params.subsurfaceBlock;
            }
        }

        return { surfaceBlock, subsurfaceBlock, baseHeight, amplitude, treeDensity };
    }

    /** Generate terrain for a chunk */
    generateChunk(chunk: Chunk): void {
        const worldOffsetX = chunk.cx * CHUNK_SIZE;
        const worldOffsetZ = chunk.cz * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = worldOffsetX + x;
                const wz = worldOffsetZ + z;
                const biome = this.getBlendedParams(wx, wz);
                const height = this.fBm(wx, wz, biome.baseHeight, biome.amplitude);

                for (let y = 0; y <= Math.max(height, WATER_LEVEL); y++) {
                    let blockId: BlockId;

                    if (y === 0) {
                        blockId = BlockId.Bedrock;
                    } else if (y > height) {
                        if (y <= WATER_LEVEL) {
                            blockId = BlockId.Water;
                        } else {
                            continue;
                        }
                    } else if (y === height) {
                        if (height <= WATER_LEVEL + 1) {
                            blockId = BlockId.Sand;
                        } else {
                            blockId = biome.surfaceBlock;
                        }
                    } else if (y > height - 3) {
                        blockId = biome.subsurfaceBlock;
                    } else {
                        blockId = BlockId.Stone;
                    }

                    chunk.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = blockId;

                    if (y > 0 && y < CAVE_MAX_HEIGHT && blockId !== BlockId.Water) {
                        const depthFactor = (CAVE_MAX_HEIGHT - y) / CAVE_MAX_HEIGHT;
                        const threshold = CAVE_THRESHOLD - depthFactor * 0.15;
                        const caveValue = this.caveNoise3D(wx * CAVE_NOISE_FREQ, y * CAVE_NOISE_FREQ, wz * CAVE_NOISE_FREQ);
                        if (caveValue > threshold && blockId !== BlockId.Bedrock) {
                            chunk.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = BlockId.Air;
                        }
                    }
                }

                // Generate trees on grass surfaces (low probability)
                if (height > WATER_LEVEL + 1 && height < CHUNK_HEIGHT - 8) {
                    // Deterministic pseudo-random based on world coords
                    const hash = ((wx * 374761393) ^ (wz * 668265263)) >>> 0;
                    if (hash % 60 === 0 && chunk.blocks[height * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] === BlockId.Grass) {
                        this.generateTree(chunk, x, height + 1, z);
                    }
                }

                this.generateOres(chunk, x, z, wx, wz, height);
            }
        }

        chunk.generated = true;
    }

    private generateOres(chunk: Chunk, x: number, z: number, wx: number, wz: number, surfaceHeight: number): void {
        const ores = [
            { id: BlockId.CoalOre, minY: 5, maxY: 28, rarity: 0.015, veinMax: 8 },
            { id: BlockId.IronOre, minY: 3, maxY: 20, rarity: 0.010, veinMax: 6 },
            { id: BlockId.GoldOre, minY: 1, maxY: 10, rarity: 0.004, veinMax: 5 },
            { id: BlockId.DiamondOre, minY: 1, maxY: 6, rarity: 0.002, veinMax: 3 },
        ];

        for (let y = 1; y < surfaceHeight - 3 && y < 30; y++) {
            const idx = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
            if (chunk.blocks[idx] !== BlockId.Stone) continue;

            const hash = ((wx * 374761393) ^ (y * 668265263) ^ (wz * 2147483647)) >>> 0;
            const roll = (hash % 100000) / 100000;

            for (const ore of ores) {
                if (y < ore.minY || y > ore.maxY) continue;
                if (roll < ore.rarity) {
                    chunk.blocks[idx] = ore.id;
                    const veinSize = 1 + (hash % ore.veinMax);
                    this.generateOreVein(chunk, x, y, z, ore.id, veinSize);
                    break;
                }
            }
        }
    }

    private generateOreVein(chunk: Chunk, x: number, y: number, z: number, oreId: BlockId, size: number): void {
        for (let i = 0; i < size; i++) {
            const nx = x + Math.floor((Math.sin(i * 7.3) + 1) * 0.5);
            const ny = y + Math.floor((Math.cos(i * 5.7) + 1) * 0.5);
            const nz = z + Math.floor((Math.sin(i * 3.1) + 1) * 0.5);
            if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
                const idx = ny * CHUNK_SIZE * CHUNK_SIZE + nz * CHUNK_SIZE + nx;
                if (chunk.blocks[idx] === BlockId.Stone) {
                    chunk.blocks[idx] = oreId;
                }
            }
        }
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

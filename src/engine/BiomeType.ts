import { BlockId } from '../blocks/BlockType';

export enum BiomeId {
    Plains = 0,
    Desert = 1,
    Forest = 2,
    Mountains = 3,
    Snow = 4,
}

export interface BiomeParams {
    surfaceBlock: BlockId;
    subsurfaceBlock: BlockId;
    baseHeight: number;
    amplitude: number;
    treeDensity: number;
}

export const BIOME_PARAMS: Record<BiomeId, BiomeParams> = {
    [BiomeId.Plains]:    { surfaceBlock: BlockId.Grass, subsurfaceBlock: BlockId.Dirt,  baseHeight: 28, amplitude: 8,  treeDensity: 0.02 },
    [BiomeId.Desert]:    { surfaceBlock: BlockId.Sand,  subsurfaceBlock: BlockId.Sand,  baseHeight: 26, amplitude: 4,  treeDensity: 0.0 },
    [BiomeId.Forest]:    { surfaceBlock: BlockId.Grass, subsurfaceBlock: BlockId.Dirt,  baseHeight: 30, amplitude: 10, treeDensity: 0.08 },
    [BiomeId.Mountains]: { surfaceBlock: BlockId.Stone, subsurfaceBlock: BlockId.Stone, baseHeight: 40, amplitude: 25, treeDensity: 0.01 },
    [BiomeId.Snow]:      { surfaceBlock: BlockId.Snow,  subsurfaceBlock: BlockId.Dirt,  baseHeight: 32, amplitude: 12, treeDensity: 0.03 },
};

export function getBiomeId(temp: number, humid: number): BiomeId {
    if (temp < -0.3) return BiomeId.Snow;
    if (temp > 0.4 && humid < 0) return BiomeId.Desert;
    if (humid > 0.3) return BiomeId.Forest;
    if (temp > 0.2) return BiomeId.Mountains;
    return BiomeId.Plains;
}

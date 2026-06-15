import { describe, it, expect } from 'vitest';
import { BiomeId, BIOME_PARAMS, getBiomeId } from '../src/engine/BiomeType';
import { BlockId } from '../src/blocks/BlockType';

describe('getBiomeId', () => {
    it('temp < -0.3 → Snow', () => {
        expect(getBiomeId(-0.5, 0)).toBe(BiomeId.Snow);
    });
    it('temp > 0.4 and humid < 0 → Desert', () => {
        expect(getBiomeId(0.6, -0.2)).toBe(BiomeId.Desert);
    });
    it('humid > 0.3 → Forest', () => {
        expect(getBiomeId(0.1, 0.5)).toBe(BiomeId.Forest);
    });
    it('temp > 0.2 (not desert) → Mountains', () => {
        expect(getBiomeId(0.3, 0.1)).toBe(BiomeId.Mountains);
    });
    it('default → Plains', () => {
        expect(getBiomeId(0.1, 0.1)).toBe(BiomeId.Plains);
    });
    it('temp exactly -0.3 is NOT Snow (boundary)', () => {
        expect(getBiomeId(-0.3, 0)).not.toBe(BiomeId.Snow);
    });
});

describe('BIOME_PARAMS', () => {
    it('Desert uses Sand for surface and subsurface', () => {
        const desert = BIOME_PARAMS[BiomeId.Desert];
        expect(desert.surfaceBlock).toBe(BlockId.Sand);
        expect(desert.subsurfaceBlock).toBe(BlockId.Sand);
    });
    it('Mountains has highest baseHeight', () => {
        const heights = Object.values(BIOME_PARAMS).map(b => b.baseHeight);
        const maxHeight = Math.max(...heights);
        expect(BIOME_PARAMS[BiomeId.Mountains].baseHeight).toBe(maxHeight);
    });
    it('Desert has treeDensity 0 (no trees)', () => {
        expect(BIOME_PARAMS[BiomeId.Desert].treeDensity).toBe(0);
    });
    it('Forest has highest treeDensity', () => {
        const densities = Object.values(BIOME_PARAMS).map(b => b.treeDensity);
        const maxDensity = Math.max(...densities);
        expect(BIOME_PARAMS[BiomeId.Forest].treeDensity).toBe(maxDensity);
    });
    it('Snow biome uses Snow block as surface', () => {
        expect(BIOME_PARAMS[BiomeId.Snow].surfaceBlock).toBe(BlockId.Snow);
    });
});

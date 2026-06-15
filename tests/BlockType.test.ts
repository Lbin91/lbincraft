import { describe, it, expect } from 'vitest';
import {
    BlockId,
    getBlockType,
    isTransparent,
    isSolid,
    isBreakable,
    isAffectedByGravity,
    HOTBAR_BLOCKS,
} from '../src/blocks/BlockType';

describe('getBlockType', () => {
    it('returns correct name for Grass', () => {
        expect(getBlockType(BlockId.Grass).name).toBe('Grass');
    });
    it('returns correct name for DiamondOre', () => {
        expect(getBlockType(BlockId.DiamondOre).name).toBe('Diamond Ore');
    });
    it('Air has solid=false', () => {
        expect(getBlockType(BlockId.Air).solid).toBe(false);
    });
});

describe('isTransparent', () => {
    it('Air is transparent', () => {
        expect(isTransparent(BlockId.Air)).toBe(true);
    });
    it('Water is transparent', () => {
        expect(isTransparent(BlockId.Water)).toBe(true);
    });
    it('Leaves are transparent', () => {
        expect(isTransparent(BlockId.Leaves)).toBe(true);
    });
    it('Stone is NOT transparent', () => {
        expect(isTransparent(BlockId.Stone)).toBe(false);
    });
    it('Grass is NOT transparent', () => {
        expect(isTransparent(BlockId.Grass)).toBe(false);
    });
});

describe('isSolid', () => {
    it('Air is NOT solid', () => {
        expect(isSolid(BlockId.Air)).toBe(false);
    });
    it('Water is NOT solid', () => {
        expect(isSolid(BlockId.Water)).toBe(false);
    });
    it('Stone is solid', () => {
        expect(isSolid(BlockId.Stone)).toBe(true);
    });
    it('Leaves are solid', () => {
        expect(isSolid(BlockId.Leaves)).toBe(true);
    });
});

describe('isBreakable', () => {
    it('Bedrock is NOT breakable', () => {
        expect(isBreakable(BlockId.Bedrock)).toBe(false);
    });
    it('Air is NOT breakable', () => {
        expect(isBreakable(BlockId.Air)).toBe(false);
    });
    it('Stone is breakable', () => {
        expect(isBreakable(BlockId.Stone)).toBe(true);
    });
    it('DiamondOre is breakable', () => {
        expect(isBreakable(BlockId.DiamondOre)).toBe(true);
    });
});

describe('isAffectedByGravity', () => {
    it('Sand is affected by gravity', () => {
        expect(isAffectedByGravity(BlockId.Sand)).toBe(true);
    });
    it('Stone is NOT affected by gravity', () => {
        expect(isAffectedByGravity(BlockId.Stone)).toBe(false);
    });
    it('Dirt is NOT affected by gravity', () => {
        expect(isAffectedByGravity(BlockId.Dirt)).toBe(false);
    });
});

describe('HOTBAR_BLOCKS', () => {
    it('excludes Air', () => {
        expect(HOTBAR_BLOCKS).not.toContain(BlockId.Air);
    });
    it('includes 8 blocks', () => {
        expect(HOTBAR_BLOCKS.length).toBe(8);
    });
    it('includes Grass and Stone', () => {
        expect(HOTBAR_BLOCKS).toContain(BlockId.Grass);
        expect(HOTBAR_BLOCKS).toContain(BlockId.Stone);
    });
});

import { describe, it, expect } from 'vitest';
import {
    isTool,
    getToolMiningSpeed,
    getToolMaxDurability,
    getRequiredToolTier,
    getToolTier,
    TOOL_IDS,
    ToolType,
    ToolMaterial,
} from '../src/inventory/ToolType';

describe('isTool', () => {
    it('returns true for 300 (WoodPickaxe)', () => {
        expect(isTool(300)).toBe(true);
    });
    it('returns true for 311 (DiamondSword)', () => {
        expect(isTool(311)).toBe(true);
    });
    it('returns false for 299', () => {
        expect(isTool(299)).toBe(false);
    });
    it('returns false for 312', () => {
        expect(isTool(312)).toBe(false);
    });
    it('returns false for block id (e.g. Stone=3)', () => {
        expect(isTool(3)).toBe(false);
    });
});

describe('getToolMiningSpeed', () => {
    it('WoodPickaxe → 2', () => {
        expect(getToolMiningSpeed(TOOL_IDS.WoodPickaxe)).toBe(2);
    });
    it('StonePickaxe → 4', () => {
        expect(getToolMiningSpeed(TOOL_IDS.StonePickaxe)).toBe(4);
    });
    it('IronPickaxe → 6', () => {
        expect(getToolMiningSpeed(TOOL_IDS.IronPickaxe)).toBe(6);
    });
    it('DiamondPickaxe → 8', () => {
        expect(getToolMiningSpeed(TOOL_IDS.DiamondPickaxe)).toBe(8);
    });
    it('non-tool → default 1', () => {
        expect(getToolMiningSpeed(999)).toBe(1);
    });
});

describe('getToolMaxDurability', () => {
    it('Wood tools → 60', () => {
        expect(getToolMaxDurability(TOOL_IDS.WoodPickaxe)).toBe(60);
        expect(getToolMaxDurability(TOOL_IDS.WoodAxe)).toBe(60);
        expect(getToolMaxDurability(TOOL_IDS.WoodSword)).toBe(60);
    });
    it('Diamond tools → 1562', () => {
        expect(getToolMaxDurability(TOOL_IDS.DiamondPickaxe)).toBe(1562);
        expect(getToolMaxDurability(TOOL_IDS.DiamondSword)).toBe(1562);
    });
    it('non-tool → default 1', () => {
        expect(getToolMaxDurability(999)).toBe(1);
    });
});

describe('getRequiredToolTier', () => {
    it('DiamondOre (14) → tier 3', () => {
        expect(getRequiredToolTier(14)).toBe(3);
    });
    it('GoldOre (13) → tier 3', () => {
        expect(getRequiredToolTier(13)).toBe(3);
    });
    it('IronOre (12) → tier 2', () => {
        expect(getRequiredToolTier(12)).toBe(2);
    });
    it('CoalOre (11) → tier 1', () => {
        expect(getRequiredToolTier(11)).toBe(1);
    });
    it('Stone (3) → tier 0', () => {
        expect(getRequiredToolTier(3)).toBe(0);
    });
});

describe('getToolTier', () => {
    it('Wood tools → 1', () => {
        expect(getToolTier(TOOL_IDS.WoodPickaxe)).toBe(1);
        expect(getToolTier(TOOL_IDS.WoodAxe)).toBe(1);
        expect(getToolTier(TOOL_IDS.WoodSword)).toBe(1);
    });
    it('Stone tools → 2', () => {
        expect(getToolTier(TOOL_IDS.StonePickaxe)).toBe(2);
    });
    it('Iron tools → 3', () => {
        expect(getToolTier(TOOL_IDS.IronPickaxe)).toBe(3);
    });
    it('Diamond tools → 4', () => {
        expect(getToolTier(TOOL_IDS.DiamondPickaxe)).toBe(4);
    });
    it('non-tool → 0', () => {
        expect(getToolTier(999)).toBe(0);
    });

    it('IronPickaxe (tier 3) can mine IronOre (requires tier 2)', () => {
        expect(getToolTier(TOOL_IDS.IronPickaxe) >= getRequiredToolTier(12)).toBe(true);
    });
    it('WoodPickaxe (tier 1) canNOT mine DiamondOre (requires tier 3)', () => {
        expect(getToolTier(TOOL_IDS.WoodPickaxe) >= getRequiredToolTier(14)).toBe(false);
    });
    it('DiamondPickaxe (tier 4) can mine everything', () => {
        expect(getToolTier(TOOL_IDS.DiamondPickaxe) >= getRequiredToolTier(14)).toBe(true);
        expect(getToolTier(TOOL_IDS.DiamondPickaxe) >= getRequiredToolTier(11)).toBe(true);
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingGrid } from '../src/inventory/CraftingGrid';
import { Inventory } from '../src/inventory/Inventory';
import { matchShapedRecipe, matchShapeless } from '../src/inventory/Recipe';
import { TOOL_IDS } from '../src/inventory/ToolType';

// Recipe.ts internal constants (duplicated here for test clarity)
const Wood = 4;
const Stone = 3;
const Stick = 260;
const CoalOre = 11;
const IronOre = 12;
const Diamond = 261;
const IronIngot = 256;

describe('matchShapedRecipe', () => {
    it('matches wood pickaxe pattern', () => {
        const grid: (number | null)[][] = [
            [Wood, Wood, Wood],
            [null, Stick, null],
            [null, Stick, null],
        ];
        const result = matchShapedRecipe(grid);
        expect(result).toEqual({ itemId: TOOL_IDS.WoodPickaxe, count: 1 });
    });

    it('matches stone pickaxe pattern', () => {
        const grid: (number | null)[][] = [
            [Stone, Stone, Stone],
            [null, Stick, null],
            [null, Stick, null],
        ];
        const result = matchShapedRecipe(grid);
        expect(result).toEqual({ itemId: TOOL_IDS.StonePickaxe, count: 1 });
    });

    it('matches iron pickaxe pattern', () => {
        const grid: (number | null)[][] = [
            [IronIngot, IronIngot, IronIngot],
            [null, Stick, null],
            [null, Stick, null],
        ];
        const result = matchShapedRecipe(grid);
        expect(result).toEqual({ itemId: TOOL_IDS.IronPickaxe, count: 1 });
    });

    it('matches wood sword (centered column)', () => {
        const grid: (number | null)[][] = [
            [null, Wood, null],
            [null, Wood, null],
            [null, Stick, null],
        ];
        const result = matchShapedRecipe(grid);
        expect(result).toEqual({ itemId: TOOL_IDS.WoodSword, count: 1 });
    });

    it('matches planks → sticks (2 vertical wood)', () => {
        const grid: (number | null)[][] = [
            [null, Wood, null],
            [null, Wood, null],
            [null, null, null],
        ];
        const result = matchShapedRecipe(grid);
        expect(result).toEqual({ itemId: Stick, count: 4 });
    });

    it('returns null for invalid pattern', () => {
        const grid: (number | null)[][] = [
            [Wood, null, null],
            [null, Stone, null],
            [null, null, Wood],
        ];
        expect(matchShapedRecipe(grid)).toBeNull();
    });

    it('returns null for empty grid', () => {
        const grid: (number | null)[][] = [
            [null, null, null],
            [null, null, null],
            [null, null, null],
        ];
        expect(matchShapedRecipe(grid)).toBeNull();
    });

    it('matches diamond pickaxe (top tier)', () => {
        const grid: (number | null)[][] = [
            [Diamond, Diamond, Diamond],
            [null, Stick, null],
            [null, Stick, null],
        ];
        const result = matchShapedRecipe(grid);
        expect(result).toEqual({ itemId: TOOL_IDS.DiamondPickaxe, count: 1 });
    });
});

describe('matchShapeless', () => {
    it('CoalOre → Coal', () => {
        expect(matchShapeless(CoalOre)).toEqual({ itemId: 258, count: 1 });
    });
    it('IronOre → IronIngot', () => {
        expect(matchShapeless(IronOre)).toEqual({ itemId: 256, count: 1 });
    });
    it('regular block returns null', () => {
        expect(matchShapeless(Wood)).toBeNull();
    });
    it('Stick returns null', () => {
        expect(matchShapeless(Stick)).toBeNull();
    });
});

describe('CraftingGrid', () => {
    let grid: CraftingGrid;

    beforeEach(() => {
        grid = new CraftingGrid();
    });

    it('starts empty with null resultSlot', () => {
        expect(grid.isGridEmpty()).toBe(true);
        expect(grid.resultSlot).toBeNull();
    });

    it('setSlot places item and updates result', () => {
        // Wood sword pattern: .W. / .W. / .S.
        grid.setSlot(0, 1, Wood);
        grid.setSlot(1, 1, Wood);
        grid.setSlot(2, 1, Stick);
        expect(grid.resultSlot).toEqual({ itemId: TOOL_IDS.WoodSword, count: 1 });
    });

    it('partial pattern (3 wood, no stick) does not match pickaxe', () => {
        // Top row of pickaxe but no handle
        grid.setSlot(0, 0, Wood);
        grid.setSlot(0, 1, Wood);
        grid.setSlot(0, 2, Wood);
        // No stick in center column → matches stick recipe (2 vertical wood)? No, this is 3 horizontal.
        // 3 wood horizontal doesn't match any shaped recipe (pickaxe needs stick handle)
        // But it does NOT match sticks (sticks need 2 vertical). So this is a non-match.
        expect(grid.resultSlot).toBeNull();
    });

    it('clearing a slot from matched recipe resets result', () => {
        // Wood sword: .W. / .W. / .S.
        grid.setSlot(0, 1, Wood);
        grid.setSlot(1, 1, Wood);
        grid.setSlot(2, 1, Stick);
        expect(grid.resultSlot).not.toBeNull();
        // Clear the stick — now only 2 vertical wood = matches Stick recipe
        grid.setSlot(2, 1, null);
        // 2 vertical wood still matches Stick recipe
        expect(grid.resultSlot).toEqual({ itemId: Stick, count: 4 });
        // Now clear one wood — no match
        grid.setSlot(0, 1, null);
        expect(grid.resultSlot).toBeNull();
    });

    it('craft() adds result to inventory and clears grid', () => {
        const inv = new Inventory();
        // Stick recipe: 2 wood vertically (col 1, rows 0-1)
        grid.setSlot(0, 1, Wood);
        grid.setSlot(1, 1, Wood);
        expect(grid.resultSlot).toEqual({ itemId: Stick, count: 4 });

        const result = grid.craft(inv);
        expect(result).toEqual({ itemId: Stick, count: 4 });
        expect(inv.getItemCount(Stick)).toBe(4);
        expect(grid.isGridEmpty()).toBe(true);
        expect(grid.resultSlot).toBeNull();
    });

    it('craft() returns null when no recipe matches', () => {
        const inv = new Inventory();
        const result = grid.craft(inv);
        expect(result).toBeNull();
    });

    it('shapeless recipe works via single-item grid', () => {
        grid.setSlot(1, 1, CoalOre);
        // single CoalOre → shapeless match
        expect(grid.resultSlot).toEqual({ itemId: 258, count: 1 });
    });

    it('setSlot ignores out-of-range indices', () => {
        grid.setSlot(5, 5, Wood);
        expect(grid.isGridEmpty()).toBe(true);
    });
});

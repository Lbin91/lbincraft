import { ItemId } from './Inventory';
import { TOOL_IDS } from './ToolType';

const Wood = 4;
const Stone = 3;
const Stick = 260;
const CoalOre = 11;
const IronOre = 12;
const GoldOre = 13;
const DiamondOre = 14;
const Coal = 258;
const IronIngot = 256;
const GoldIngot = 257;
const Diamond = 261;

export interface ShapedRecipe {
    pattern: string[];
    key: Record<string, ItemId>;
    result: { itemId: ItemId; count: number };
}

export const SHAPED_RECIPES: ShapedRecipe[] = [
    {
        pattern: ['W', 'W'],
        key: { W: Wood },
        result: { itemId: Stick, count: 4 },
    },
    {
        pattern: ['WWW', '.S.', '.S.'],
        key: { W: Wood, S: Stick },
        result: { itemId: TOOL_IDS.WoodPickaxe, count: 1 },
    },
    {
        pattern: ['TTT', '.S.', '.S.'],
        key: { T: Stone, S: Stick },
        result: { itemId: TOOL_IDS.StonePickaxe, count: 1 },
    },
    {
        pattern: ['III', '.S.', '.S.'],
        key: { I: IronIngot, S: Stick },
        result: { itemId: TOOL_IDS.IronPickaxe, count: 1 },
    },
    {
        pattern: ['DDD', '.S.', '.S.'],
        key: { D: Diamond, S: Stick },
        result: { itemId: TOOL_IDS.DiamondPickaxe, count: 1 },
    },
    {
        pattern: ['WW.', 'WS.', '.S.'],
        key: { W: Wood, S: Stick },
        result: { itemId: TOOL_IDS.WoodAxe, count: 1 },
    },
    {
        pattern: ['TT.', 'TS.', '.S.'],
        key: { T: Stone, S: Stick },
        result: { itemId: TOOL_IDS.StoneAxe, count: 1 },
    },
    {
        pattern: ['II.', 'IS.', '.S.'],
        key: { I: IronIngot, S: Stick },
        result: { itemId: TOOL_IDS.IronAxe, count: 1 },
    },
    {
        pattern: ['DD.', 'DS.', '.S.'],
        key: { D: Diamond, S: Stick },
        result: { itemId: TOOL_IDS.DiamondAxe, count: 1 },
    },
    {
        pattern: ['.W.', '.W.', '.S.'],
        key: { W: Wood, S: Stick },
        result: { itemId: TOOL_IDS.WoodSword, count: 1 },
    },
    {
        pattern: ['.T.', '.T.', '.S.'],
        key: { T: Stone, S: Stick },
        result: { itemId: TOOL_IDS.StoneSword, count: 1 },
    },
    {
        pattern: ['.I.', '.I.', '.S.'],
        key: { I: IronIngot, S: Stick },
        result: { itemId: TOOL_IDS.IronSword, count: 1 },
    },
    {
        pattern: ['.D.', '.D.', '.S.'],
        key: { D: Diamond, S: Stick },
        result: { itemId: TOOL_IDS.DiamondSword, count: 1 },
    },
];

export const SHAPELESS_RECIPES = [
    { input: CoalOre, output: { itemId: Coal, count: 1 } },
    { input: IronOre, output: { itemId: IronIngot, count: 1 } },
    { input: GoldOre, output: { itemId: GoldIngot, count: 1 } },
    { input: DiamondOre, output: { itemId: Diamond, count: 1 } },
];

export function matchShapedRecipe(grid: (ItemId | null)[][]): { itemId: ItemId; count: number } | null {
    for (const recipe of SHAPED_RECIPES) {
        const normalizedPattern = normalizePattern(recipe.pattern);

        const recipeRows = normalizedPattern.length;
        const recipeCols = normalizedPattern[0].length;
        const rowOffset = Math.floor((3 - recipeRows) / 2);
        const colOffset = Math.floor((3 - recipeCols) / 2);

        let match = true;
        for (let r = 0; r < 3 && match; r++) {
            for (let c = 0; c < 3 && match; c++) {
                const recipeR = r - rowOffset;
                const recipeC = c - colOffset;

                let expectedItem: ItemId | null = null;
                if (recipeR >= 0 && recipeR < recipeRows && recipeC >= 0 && recipeC < recipeCols) {
                    const ch = normalizedPattern[recipeR][recipeC];
                    if (ch !== '.') {
                        expectedItem = recipe.key[ch] ?? null;
                    }
                }

                const gridItem = grid[r][c];
                if (expectedItem !== gridItem) {
                    match = false;
                }
            }
        }

        if (match) return recipe.result;
    }
    return null;
}

function normalizePattern(pattern: string[]): string[][] {
    let minRow = pattern.length;
    let maxRow = -1;
    let minCol = pattern[0].length;
    let maxCol = -1;

    for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < pattern[r].length; c++) {
            if (pattern[r][c] !== '.') {
                minRow = Math.min(minRow, r);
                maxRow = Math.max(maxRow, r);
                minCol = Math.min(minCol, c);
                maxCol = Math.max(maxCol, c);
            }
        }
    }

    if (maxRow < 0) return [['.']];

    const result: string[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
        const row: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
            row.push(pattern[r][c] || '.');
        }
        result.push(row);
    }
    return result;
}

export function matchShapeless(itemId: ItemId): { itemId: ItemId; count: number } | null {
    for (const recipe of SHAPELESS_RECIPES) {
        if (recipe.input === itemId) return recipe.output;
    }
    return null;
}

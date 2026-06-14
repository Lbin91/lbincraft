export enum ToolType {
    Axe = 'axe',
    Pickaxe = 'pickaxe',
    Sword = 'sword',
}

export enum ToolMaterial {
    Wood = 'wood',
    Stone = 'stone',
    Iron = 'iron',
    Diamond = 'diamond',
}

export interface ToolData {
    type: ToolType;
    material: ToolMaterial;
    durability: number;
    maxDurability: number;
    miningSpeed: number;
}

export const TOOL_IDS = {
    WoodPickaxe: 300,
    StonePickaxe: 301,
    IronPickaxe: 302,
    DiamondPickaxe: 303,
    WoodAxe: 304,
    StoneAxe: 305,
    IronAxe: 306,
    DiamondAxe: 307,
    WoodSword: 308,
    StoneSword: 309,
    IronSword: 310,
    DiamondSword: 311,
} as const;

export const TOOL_MINING_SPEED: Record<number, number> = {
    [TOOL_IDS.WoodPickaxe]: 2,
    [TOOL_IDS.StonePickaxe]: 4,
    [TOOL_IDS.IronPickaxe]: 6,
    [TOOL_IDS.DiamondPickaxe]: 8,
    [TOOL_IDS.WoodAxe]: 2,
    [TOOL_IDS.StoneAxe]: 4,
    [TOOL_IDS.IronAxe]: 6,
    [TOOL_IDS.DiamondAxe]: 8,
};

export const TOOL_MAX_DURABILITY: Record<number, number> = {
    [TOOL_IDS.WoodPickaxe]: 60,
    [TOOL_IDS.StonePickaxe]: 132,
    [TOOL_IDS.IronPickaxe]: 251,
    [TOOL_IDS.DiamondPickaxe]: 1562,
    [TOOL_IDS.WoodAxe]: 60,
    [TOOL_IDS.StoneAxe]: 132,
    [TOOL_IDS.IronAxe]: 251,
    [TOOL_IDS.DiamondAxe]: 1562,
    [TOOL_IDS.WoodSword]: 60,
    [TOOL_IDS.StoneSword]: 132,
    [TOOL_IDS.IronSword]: 251,
    [TOOL_IDS.DiamondSword]: 1562,
};

export function isTool(itemId: number): boolean {
    return itemId >= 300 && itemId <= 311;
}

export function getToolMiningSpeed(itemId: number): number {
    return TOOL_MINING_SPEED[itemId] ?? 1;
}

export function getToolMaxDurability(itemId: number): number {
    return TOOL_MAX_DURABILITY[itemId] ?? 1;
}

export function getRequiredToolTier(blockId: number): number {
    if (blockId === 14) return 3;
    if (blockId === 13) return 3;
    if (blockId === 12) return 2;
    if (blockId === 11) return 1;
    return 0;
}

export function getToolTier(itemId: number): number {
    if (itemId === TOOL_IDS.WoodPickaxe || itemId === TOOL_IDS.WoodAxe || itemId === TOOL_IDS.WoodSword) return 1;
    if (itemId === TOOL_IDS.StonePickaxe || itemId === TOOL_IDS.StoneAxe || itemId === TOOL_IDS.StoneSword) return 2;
    if (itemId === TOOL_IDS.IronPickaxe || itemId === TOOL_IDS.IronAxe || itemId === TOOL_IDS.IronSword) return 3;
    if (itemId === TOOL_IDS.DiamondPickaxe || itemId === TOOL_IDS.DiamondAxe || itemId === TOOL_IDS.DiamondSword) return 4;
    return 0;
}

export const TOOL_INFO: Record<number, { name: string; color: string }> = {
    [TOOL_IDS.WoodPickaxe]: { name: 'Wood Pickaxe', color: '#8B6240' },
    [TOOL_IDS.StonePickaxe]: { name: 'Stone Pickaxe', color: '#888888' },
    [TOOL_IDS.IronPickaxe]: { name: 'Iron Pickaxe', color: '#c8a878' },
    [TOOL_IDS.DiamondPickaxe]: { name: 'Diamond Pickaxe', color: '#5af0e0' },
    [TOOL_IDS.WoodAxe]: { name: 'Wood Axe', color: '#8B6240' },
    [TOOL_IDS.StoneAxe]: { name: 'Stone Axe', color: '#888888' },
    [TOOL_IDS.IronAxe]: { name: 'Iron Axe', color: '#c8a878' },
    [TOOL_IDS.DiamondAxe]: { name: 'Diamond Axe', color: '#5af0e0' },
    [TOOL_IDS.WoodSword]: { name: 'Wood Sword', color: '#8B6240' },
    [TOOL_IDS.StoneSword]: { name: 'Stone Sword', color: '#888888' },
    [TOOL_IDS.IronSword]: { name: 'Iron Sword', color: '#c8a878' },
    [TOOL_IDS.DiamondSword]: { name: 'Diamond Sword', color: '#5af0e0' },
};

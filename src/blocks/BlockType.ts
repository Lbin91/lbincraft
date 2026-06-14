/**
 * Block type definitions for the voxel world.
 */

export enum BlockId {
    Air = 0,
    Grass = 1,
    Dirt = 2,
    Stone = 3,
    Wood = 4,
    Leaves = 5,
    Sand = 6,
    Water = 7,
    Bedrock = 8,
    Snow = 9,
    Ice = 10,
    CoalOre = 11,
    IronOre = 12,
    GoldOre = 13,
    DiamondOre = 14,
}

export interface BlockType {
    id: BlockId;
    name: string;
    transparent: boolean;
    solid: boolean;
    breakable: boolean;
    affectedByGravity: boolean;
    colors: {
        top: string;
        bottom: string;
        side: string;
    };
}

const BLOCK_DEFINITIONS: Record<BlockId, BlockType> = {
    [BlockId.Air]: {
        id: BlockId.Air, name: 'Air', transparent: true, solid: false, breakable: false, affectedByGravity: false,
        colors: { top: '#000000', bottom: '#000000', side: '#000000' },
    },
    [BlockId.Grass]: {
        id: BlockId.Grass, name: 'Grass', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#5fb84f', bottom: '#8b6240', side: '#7a9e4f' },
    },
    [BlockId.Dirt]: {
        id: BlockId.Dirt, name: 'Dirt', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#8b6240', bottom: '#8b6240', side: '#8b6240' },
    },
    [BlockId.Stone]: {
        id: BlockId.Stone, name: 'Stone', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#888888', bottom: '#888888', side: '#888888' },
    },
    [BlockId.Wood]: {
        id: BlockId.Wood, name: 'Wood', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#a0784a', bottom: '#a0784a', side: '#6b4f2a' },
    },
    [BlockId.Leaves]: {
        id: BlockId.Leaves, name: 'Leaves', transparent: true, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#3a8a2a', bottom: '#3a8a2a', side: '#3a8a2a' },
    },
    [BlockId.Sand]: {
        id: BlockId.Sand, name: 'Sand', transparent: false, solid: true, breakable: true, affectedByGravity: true,
        colors: { top: '#e6d8a0', bottom: '#e6d8a0', side: '#e6d8a0' },
    },
    [BlockId.Water]: {
        id: BlockId.Water, name: 'Water', transparent: true, solid: false, breakable: false, affectedByGravity: false,
        colors: { top: '#3b6ea8', bottom: '#3b6ea8', side: '#3b6ea8' },
    },
    [BlockId.Bedrock]: {
        id: BlockId.Bedrock, name: 'Bedrock', transparent: false, solid: true, breakable: false, affectedByGravity: false,
        colors: { top: '#333333', bottom: '#333333', side: '#333333' },
    },
    [BlockId.Snow]: {
        id: BlockId.Snow, name: 'Snow', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#f5f5f5', bottom: '#f5f5f5', side: '#e8e8e8' },
    },
    [BlockId.Ice]: {
        id: BlockId.Ice, name: 'Ice', transparent: true, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#8fc4e8', bottom: '#8fc4e8', side: '#8fc4e8' },
    },
    [BlockId.CoalOre]: {
        id: BlockId.CoalOre, name: 'Coal Ore', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#3a3a3a', bottom: '#3a3a3a', side: '#2a2a2a' },
    },
    [BlockId.IronOre]: {
        id: BlockId.IronOre, name: 'Iron Ore', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#c8a878', bottom: '#c8a878', side: '#b89868' },
    },
    [BlockId.GoldOre]: {
        id: BlockId.GoldOre, name: 'Gold Ore', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#fadc50', bottom: '#fadc50', side: '#eacc40' },
    },
    [BlockId.DiamondOre]: {
        id: BlockId.DiamondOre, name: 'Diamond Ore', transparent: false, solid: true, breakable: true, affectedByGravity: false,
        colors: { top: '#5af0e0', bottom: '#5af0e0', side: '#4ae0d0' },
    },
};

export function getBlockType(id: BlockId): BlockType {
    return BLOCK_DEFINITIONS[id];
}

export function isTransparent(id: BlockId): boolean {
    return BLOCK_DEFINITIONS[id]?.transparent ?? true;
}

export function isSolid(id: BlockId): boolean {
    return BLOCK_DEFINITIONS[id]?.solid ?? false;
}

export function isBreakable(id: BlockId): boolean {
    return BLOCK_DEFINITIONS[id]?.breakable ?? false;
}

export function isAffectedByGravity(id: BlockId): boolean {
    return BLOCK_DEFINITIONS[id]?.affectedByGravity ?? false;
}

/** Blocks available in the hotbar (excluding Air) */
export const HOTBAR_BLOCKS: BlockId[] = [
    BlockId.Grass,
    BlockId.Dirt,
    BlockId.Stone,
    BlockId.Wood,
    BlockId.Leaves,
    BlockId.Sand,
    BlockId.Snow,
    BlockId.Bedrock,
];

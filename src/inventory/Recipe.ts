import { ItemId } from './Inventory';

export interface Recipe {
    ingredients: { itemId: ItemId; count: number }[];
    result: { itemId: ItemId; count: number };
}

export const RECIPES: Recipe[] = [
    {
        ingredients: [{ itemId: 4, count: 1 }],
        result: { itemId: 260, count: 4 },
    },
    {
        ingredients: [{ itemId: 3, count: 4 }],
        result: { itemId: 3, count: 1 },
    },
];

export function findRecipe(availableItems: { itemId: ItemId; count: number }[]): Recipe | null {
    for (const recipe of RECIPES) {
        const canCraft = recipe.ingredients.every(ing => {
            const available = availableItems.find(a => a.itemId === ing.itemId);
            return available && available.count >= ing.count;
        });
        if (canCraft) return recipe;
    }
    return null;
}

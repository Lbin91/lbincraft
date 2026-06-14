import { Inventory, ItemId } from './Inventory';
import { matchShapedRecipe, matchShapeless } from './Recipe';

export class CraftingGrid {
    grid: (ItemId | null)[][];
    resultSlot: { itemId: ItemId; count: number } | null;

    constructor() {
        this.grid = [
            [null, null, null],
            [null, null, null],
            [null, null, null],
        ];
        this.resultSlot = null;
    }

    setSlot(row: number, col: number, itemId: ItemId | null): void {
        if (row >= 0 && row < 3 && col >= 0 && col < 3) {
            this.grid[row][col] = itemId;
            this.updateResult();
        }
    }

    private updateResult(): void {
        const shaped = matchShapedRecipe(this.grid);
        if (shaped) {
            this.resultSlot = shaped;
            return;
        }

        const items = this.grid.flat().filter(x => x !== null) as ItemId[];
        if (items.length === 1) {
            const shapeless = matchShapeless(items[0]);
            if (shapeless) {
                this.resultSlot = shapeless;
                return;
            }
        }

        this.resultSlot = null;
    }

    craft(inventory: Inventory): { itemId: ItemId; count: number } | null {
        if (!this.resultSlot) return null;

        const result = this.resultSlot;
        inventory.addItem(result.itemId, result.count);

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                this.grid[r][c] = null;
            }
        }
        this.resultSlot = null;

        return result;
    }

    isGridEmpty(): boolean {
        return this.grid.every(row => row.every(cell => cell === null));
    }
}

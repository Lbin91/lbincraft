export type ItemId = number;

export const Items = {
    IronIngot: 256,
    GoldIngot: 257,
    Coal: 258,
    Apple: 259,
    Stick: 260,
} as const;

export interface ItemStack {
    itemId: ItemId;
    count: number;
}

const MAX_STACK = 64;

export class Inventory {
    slots: (ItemStack | null)[];
    hotbar: (ItemStack | null)[];
    selectedSlot: number = 0;

    constructor() {
        this.slots = new Array(27).fill(null);
        this.hotbar = new Array(9).fill(null);
    }

    addItem(itemId: ItemId, count: number = 1): boolean {
        let remaining = count;

        for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
            const stack = this.hotbar[i];
            if (stack && stack.itemId === itemId && stack.count < MAX_STACK) {
                const space = MAX_STACK - stack.count;
                const add = Math.min(space, remaining);
                stack.count += add;
                remaining -= add;
            }
        }

        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            const stack = this.slots[i];
            if (stack && stack.itemId === itemId && stack.count < MAX_STACK) {
                const space = MAX_STACK - stack.count;
                const add = Math.min(space, remaining);
                stack.count += add;
                remaining -= add;
            }
        }

        for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
            if (this.hotbar[i] === null) {
                const add = Math.min(MAX_STACK, remaining);
                this.hotbar[i] = { itemId, count: add };
                remaining -= add;
            }
        }

        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            if (this.slots[i] === null) {
                const add = Math.min(MAX_STACK, remaining);
                this.slots[i] = { itemId, count: add };
                remaining -= add;
            }
        }

        return remaining === 0;
    }

    removeItem(itemId: ItemId, count: number = 1): boolean {
        let available = this.getItemCount(itemId);
        if (available < count) return false;

        let remaining = count;
        for (const arr of [this.hotbar, this.slots]) {
            for (let i = 0; i < arr.length && remaining > 0; i++) {
                const stack = arr[i];
                if (stack && stack.itemId === itemId) {
                    const remove = Math.min(stack.count, remaining);
                    stack.count -= remove;
                    remaining -= remove;
                    if (stack.count === 0) arr[i] = null;
                }
            }
        }

        return true;
    }

    getItemCount(itemId: ItemId): number {
        let total = 0;
        for (const arr of [this.hotbar, this.slots]) {
            for (const stack of arr) {
                if (stack && stack.itemId === itemId) {
                    total += stack.count;
                }
            }
        }
        return total;
    }

    getSelectedStack(): ItemStack | null {
        return this.hotbar[this.selectedSlot];
    }

    selectSlot(index: number): void {
        if (index >= 0 && index < this.hotbar.length) {
            this.selectedSlot = index;
        }
    }

    fillCreative(items: ItemId[]): void {
        for (let i = 0; i < items.length && i < this.hotbar.length; i++) {
            this.hotbar[i] = { itemId: items[i], count: MAX_STACK };
        }
    }
}

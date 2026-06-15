import { describe, it, expect, beforeEach } from 'vitest';
import { Inventory, Items, ItemId, ItemStack } from '../src/inventory/Inventory';

describe('Inventory basics', () => {
    let inv: Inventory;

    beforeEach(() => {
        inv = new Inventory();
    });

    it('starts empty with 27 slots + 9 hotbar', () => {
        expect(inv.slots.length).toBe(27);
        expect(inv.hotbar.length).toBe(9);
        expect(inv.getItemCount(Items.Stick)).toBe(0);
    });

    it('selectedSlot defaults to 0', () => {
        expect(inv.selectedSlot).toBe(0);
    });
});

describe('Inventory.addItem', () => {
    let inv: Inventory;

    beforeEach(() => {
        inv = new Inventory();
    });

    it('adds single item to hotbar', () => {
        const ok = inv.addItem(Items.Stick, 1);
        expect(ok).toBe(true);
        expect(inv.getItemCount(Items.Stick)).toBe(1);
    });

    it('stacks up to 64', () => {
        inv.addItem(Items.Stick, 64);
        expect(inv.hotbar[0]?.count).toBe(64);
        expect(inv.getItemCount(Items.Stick)).toBe(64);
    });

    it('overflows to second stack when exceeding 64', () => {
        inv.addItem(Items.Stick, 70);
        expect(inv.getItemCount(Items.Stick)).toBe(70);
        expect(inv.hotbar[0]?.count).toBe(64);
        expect(inv.hotbar[1]?.count).toBe(6);
    });

    it('tools (id >= 300) don\'t stack — each slot gets count 1', () => {
        inv.addItem(300, 3); // 3 tools
        expect(inv.hotbar[0]).toEqual({ itemId: 300, count: 1 });
        expect(inv.hotbar[1]).toEqual({ itemId: 300, count: 1 });
        expect(inv.hotbar[2]).toEqual({ itemId: 300, count: 1 });
        expect(inv.getItemCount(300)).toBe(3);
    });

    it('returns false when inventory is full', () => {
        // 9 hotbar + 27 slots = 36 slots × 64 = 2304 max
        const ok = inv.addItem(Items.Stick, 2304);
        expect(ok).toBe(true);
        // Adding 1 more should fail
        const ok2 = inv.addItem(Items.Stick, 1);
        expect(ok2).toBe(false);
    });
});

describe('Inventory.removeItem', () => {
    let inv: Inventory;

    beforeEach(() => {
        inv = new Inventory();
    });

    it('removes items correctly', () => {
        inv.addItem(Items.Coal, 10);
        const ok = inv.removeItem(Items.Coal, 3);
        expect(ok).toBe(true);
        expect(inv.getItemCount(Items.Coal)).toBe(7);
    });

    it('clears slot when count reaches 0', () => {
        inv.addItem(Items.Coal, 5);
        inv.removeItem(Items.Coal, 5);
        expect(inv.hotbar[0]).toBeNull();
    });

    it('returns false when not enough items', () => {
        inv.addItem(Items.Coal, 3);
        const ok = inv.removeItem(Items.Coal, 5);
        expect(ok).toBe(false);
        expect(inv.getItemCount(Items.Coal)).toBe(3);
    });

    it('returns false when removing from empty inventory', () => {
        const ok = inv.removeItem(Items.Coal, 1);
        expect(ok).toBe(false);
    });
});

describe('Inventory.selectSlot', () => {
    let inv: Inventory;

    beforeEach(() => {
        inv = new Inventory();
    });

    it('changes selectedSlot', () => {
        inv.selectSlot(3);
        expect(inv.selectedSlot).toBe(3);
    });

    it('ignores out-of-range slot', () => {
        inv.selectSlot(0);
        inv.selectSlot(99);
        expect(inv.selectedSlot).toBe(0);
    });

    it('ignores negative slot', () => {
        inv.selectSlot(-1);
        expect(inv.selectedSlot).toBe(0);
    });

    it('getSelectedStack returns the selected hotbar stack', () => {
        inv.addItem(Items.Diamond, 1);
        inv.selectSlot(0);
        const stack = inv.getSelectedStack();
        expect(stack?.itemId).toBe(Items.Diamond);
    });
});

describe('Inventory.fillCreative', () => {
    let inv: Inventory;

    beforeEach(() => {
        inv = new Inventory();
    });

    it('fills hotbar with given items at max stack (64)', () => {
        inv.fillCreative([1, 3, 4]);
        expect(inv.hotbar[0]).toEqual({ itemId: 1, count: 64 });
        expect(inv.hotbar[1]).toEqual({ itemId: 3, count: 64 });
        expect(inv.hotbar[2]).toEqual({ itemId: 4, count: 64 });
    });

    it('does not overflow 9 hotbar slots', () => {
        inv.fillCreative([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(inv.hotbar[8]).toEqual({ itemId: 9, count: 64 });
        // slot 9 would be index 8 → the 10th item is ignored
    });
});

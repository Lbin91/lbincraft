import { Inventory, ItemStack } from './Inventory';
import { getBlockType, BlockId } from '../blocks/BlockType';

export class InventoryUI {
    private panel: HTMLDivElement;
    private hotbarEl: HTMLDivElement;
    private slotsEl: HTMLDivElement;
    private inventory: Inventory;
    private isVisible: boolean = false;
    private heldStack: ItemStack | null = null;
    private heldStackEl: HTMLDivElement | null = null;

    constructor(inventory: Inventory) {
        this.inventory = inventory;
        this.panel = document.createElement('div');
        this.panel.className = 'inventory-panel';
        this.panel.style.cssText = `
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(20, 20, 30, 0.95);
            border: 2px solid #555;
            border-radius: 8px;
            padding: 16px;
            z-index: 100;
            font-family: monospace;
            color: #fff;
            user-select: none;
        `;

        // Title
        const title = document.createElement('div');
        title.textContent = 'Inventory';
        title.style.cssText = 'font-size: 14px; margin-bottom: 8px; text-align: center;';
        this.panel.appendChild(title);

        // Crafting area placeholder (Feature 14 will fill this)
        const craftArea = document.createElement('div');
        craftArea.id = 'crafting-area-placeholder';
        craftArea.style.cssText = 'margin-bottom: 12px;';
        this.panel.appendChild(craftArea);

        // Inventory grid (27 slots, 9 columns x 3 rows)
        this.slotsEl = document.createElement('div');
        this.slotsEl.style.cssText = `
            display: grid;
            grid-template-columns: repeat(9, 40px);
            gap: 2px;
            margin-bottom: 8px;
        `;
        for (let i = 0; i < 27; i++) {
            this.slotsEl.appendChild(this.createSlot('inventory', i));
        }
        this.panel.appendChild(this.slotsEl);

        // Hotbar (9 slots)
        this.hotbarEl = document.createElement('div');
        this.hotbarEl.style.cssText = `
            display: grid;
            grid-template-columns: repeat(9, 40px);
            gap: 2px;
            border-top: 1px solid #444;
            padding-top: 8px;
        `;
        for (let i = 0; i < 9; i++) {
            this.hotbarEl.appendChild(this.createSlot('hotbar', i));
        }
        this.panel.appendChild(this.hotbarEl);

        // Held item (follows cursor)
        document.addEventListener('mousemove', (e) => {
            if (this.heldStackEl) {
                this.heldStackEl.style.left = `${e.clientX}px`;
                this.heldStackEl.style.top = `${e.clientY}px`;
            }
        });
    }

    private createSlot(section: 'hotbar' | 'inventory', index: number): HTMLDivElement {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.section = section;
        slot.dataset.index = String(index);
        slot.style.cssText = `
            width: 40px;
            height: 40px;
            background: rgba(60, 60, 70, 0.8);
            border: 1px solid #333;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            position: relative;
            cursor: pointer;
        `;

        slot.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.handleSlotClick(section, index);
        });

        return slot;
    }

    private handleSlotClick(section: 'hotbar' | 'inventory', index: number): void {
        const arr = section === 'hotbar' ? this.inventory.hotbar : this.inventory.slots;
        const clickedStack = arr[index];

        if (this.heldStack === null) {
            // Pick up stack from slot
            if (clickedStack) {
                this.heldStack = clickedStack;
                arr[index] = null;
                this.createHeldStackElement();
            }
        } else {
            // Place held stack into slot
            if (clickedStack === null) {
                arr[index] = this.heldStack;
                this.heldStack = null;
                this.removeHeldStackElement();
            } else if (clickedStack.itemId === this.heldStack.itemId) {
                // Merge stacks
                const total = clickedStack.count + this.heldStack.count;
                if (total <= 64) {
                    clickedStack.count = total;
                    this.heldStack = null;
                    this.removeHeldStackElement();
                } else {
                    clickedStack.count = 64;
                    this.heldStack.count = total - 64;
                }
            } else {
                // Swap
                arr[index] = this.heldStack;
                this.heldStack = clickedStack;
                // update held element
                this.updateHeldStackElement();
            }
        }
        this.render();
    }

    private createHeldStackElement(): void {
        this.heldStackEl = document.createElement('div');
        this.heldStackEl.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 1000;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: translate(-50%, -50%);
            font-size: 11px;
            color: #fff;
            text-shadow: 1px 1px 2px #000;
            border: 1px solid rgba(255,255,255,0.5);
            border-radius: 2px;
        `;
        this.updateHeldStackElement();
        document.body.appendChild(this.heldStackEl);
    }

    private updateHeldStackElement(): void {
        if (!this.heldStackEl || !this.heldStack) return;
        const blockType = getBlockType(this.heldStack.itemId as BlockId);
        if (blockType) {
            this.heldStackEl.style.backgroundColor = blockType.colors.top;
        }
        this.heldStackEl.textContent = this.heldStack.count > 1 ? String(this.heldStack.count) : '';
    }

    private removeHeldStackElement(): void {
        if (this.heldStackEl) {
            this.heldStackEl.remove();
            this.heldStackEl = null;
        }
    }

    private renderSlot(slot: HTMLDivElement, stack: ItemStack | null): void {
        slot.innerHTML = '';
        slot.style.backgroundColor = 'rgba(60, 60, 70, 0.8)';

        if (stack && stack.count > 0) {
            const blockType = getBlockType(stack.itemId as BlockId);
            if (blockType) {
                slot.style.backgroundColor = blockType.colors.top;
            }
            if (stack.count > 1) {
                const count = document.createElement('span');
                count.textContent = String(stack.count);
                count.style.cssText = 'color:#fff;text-shadow:1px 1px 2px #000;position:absolute;bottom:1px;right:3px;';
                slot.appendChild(count);
            }
        }
    }

    render(): void {
        const hotbarSlots = this.hotbarEl.querySelectorAll('[data-section="hotbar"]');
        const invSlots = this.slotsEl.querySelectorAll('[data-section="inventory"]');

        hotbarSlots.forEach((el, i) => {
            this.renderSlot(el as HTMLDivElement, this.inventory.hotbar[i]);
        });
        invSlots.forEach((el, i) => {
            this.renderSlot(el as HTMLDivElement, this.inventory.slots[i]);
        });
    }

    getPanel(): HTMLDivElement {
        return this.panel;
    }

    toggle(): boolean {
        this.isVisible = !this.isVisible;
        this.panel.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.render();
        } else {
            // Return held stack to inventory if exists
            if (this.heldStack) {
                this.inventory.addItem(this.heldStack.itemId, this.heldStack.count);
                this.heldStack = null;
                this.removeHeldStackElement();
            }
        }
        return this.isVisible;
    }

    get isOpen(): boolean {
        return this.isVisible;
    }
}

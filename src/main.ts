/**
 * VoxelCraft - main entry point.
 * Sets up the game, UI elements, and event handlers.
 */

import { Game } from './engine/Game';
import { HOTBAR_BLOCKS, getBlockType } from './blocks/BlockType';

// Create game instance
const game = new Game();

// Initialize (loads spawn area)
game.init();

// Setup UI
setupHotbar();
setupOverlay();
setupDebug();
setupKeyboardShortcuts();
setupContextMenu();
setupMinimap();

// Start game loop
game.start();

declare global {
    interface Window {
        game: typeof game;
    }
}
window.game = game;

// --- UI Setup Functions ---

function setupHotbar(): void {
    const hotbar = document.getElementById('hotbar');
    if (!hotbar) return;

    HOTBAR_BLOCKS.forEach((blockId, index) => {
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot';
        if (index === 0) slot.classList.add('active');

        // Use block color as visual indicator
        const blockType = getBlockType(blockId);
        slot.style.backgroundColor = blockType.colors.top;
        slot.textContent = String(index + 1);

        slot.addEventListener('click', () => selectSlot(index));
        hotbar.appendChild(slot);
    });
}

function selectSlot(index: number): void {
    game.selectSlot(index);

    // Update UI
    const slots = document.querySelectorAll('.hotbar-slot');
    slots.forEach((slot, i) => {
        slot.classList.toggle('active', i === index);
    });
}

function setupOverlay(): void {
    const overlay = document.getElementById('overlay');
    if (!overlay) return;

    overlay.addEventListener('click', () => {
        game.controls.lockPointer();
    });

    // Hide overlay when pointer is locked
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        overlay.style.display = isLocked ? 'none' : 'flex';
    });
}

function setupDebug(): void {
    const debug = document.getElementById('debug');
    if (!debug) return;

    game.onStatsUpdate = (stats) => {
        debug.innerHTML = `
            FPS: ${stats.fps}<br>
            X: ${stats.x} &nbsp; Y: ${stats.y} &nbsp; Z: ${stats.z}<br>
            Chunks: ${stats.chunks}
        `;
    };

    game.onSaveStatus = (message) => {
        const existing = document.getElementById('save-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'save-toast';
        toast.style.cssText = 'position:absolute;top:10px;right:10px;color:#aaffaa;font-size:0.85rem;text-shadow:1px 1px 2px black;z-index:60;pointer-events:none;opacity:1;transition:opacity 1s;';
        toast.textContent = message;
        document.getElementById('app')?.appendChild(toast);

        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
        setTimeout(() => { toast.remove(); }, 3000);
    };
}

function setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 8) {
            selectSlot(num - 1);
        }

        if (e.key === 'm' || e.key === 'M') {
            const enabled = game.audio.toggleMute();
            const toast = document.createElement('div');
            toast.style.cssText = 'position:absolute;top:50px;left:50%;transform:translateX(-50%);color:#fff;font-size:0.9rem;background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:4px;z-index:100;';
            toast.textContent = enabled ? '🔊 Sound On' : '🔇 Muted';
            document.getElementById('app')?.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        }
    });

    // Mouse wheel for hotbar cycling
    document.addEventListener('wheel', (e) => {
        if (!game.controls.isLocked()) return;
        const current = game.selectedSlot;
        const next = e.deltaY > 0
            ? (current + 1) % HOTBAR_BLOCKS.length
            : (current - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
        selectSlot(next);
    });
}

function setupContextMenu(): void {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupMinimap(): void {
    const app = document.getElementById('app');
    if (!app) return;
    app.appendChild(game.minimap.getCanvas());
}

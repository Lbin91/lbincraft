/**
 * Canvas 2D minimap showing top-down view of surrounding terrain.
 * Updates at 10fps (every 0.1s) for performance.
 */
import { World } from '../engine/World';
import { getBlockType, BlockId } from '../blocks/BlockType';

const MAP_SIZE = 150;       // canvas pixel size
const BLOCK_RANGE = 32;     // blocks visible in each direction from center
const UPDATE_INTERVAL = 0.1; // seconds between updates

export class Minimap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private updateTimer: number = 0;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = MAP_SIZE;
        this.canvas.height = MAP_SIZE;
        this.canvas.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            z-index: 50;
            pointer-events: none;
            image-rendering: pixelated;
        `;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        this.ctx = ctx;
    }

    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    update(delta: number, playerX: number, playerZ: number, playerYaw: number, world: World): void {
        this.updateTimer += delta;
        if (this.updateTimer < UPDATE_INTERVAL) return;
        this.updateTimer = 0;

        const pixelsPerBlock = MAP_SIZE / (BLOCK_RANGE * 2);
        const centerX = MAP_SIZE / 2;
        const centerY = MAP_SIZE / 2;

        // Clear background
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

        // Scan blocks around player
        const baseX = Math.floor(playerX);
        const baseZ = Math.floor(playerZ);

        for (let dx = -BLOCK_RANGE; dx <= BLOCK_RANGE; dx++) {
            for (let dz = -BLOCK_RANGE; dz <= BLOCK_RANGE; dz++) {
                const worldX = baseX + dx;
                const worldZ = baseZ + dz;

                // Find topmost non-air block
                let topBlockId = BlockId.Air;
                for (let y = 80; y >= 1; y--) {
                    const blockId = world.getBlock(worldX, y, worldZ);
                    if (blockId !== BlockId.Air) {
                        topBlockId = blockId as BlockId;
                        break;
                    }
                }

                if (topBlockId === BlockId.Air) continue;

                // Get block color
                const blockType = getBlockType(topBlockId);
                this.ctx.fillStyle = blockType.colors.top;

                // Draw pixel
                const px = centerX + dx * pixelsPerBlock;
                const py = centerY + dz * pixelsPerBlock;
                const size = Math.max(1, Math.ceil(pixelsPerBlock));
                this.ctx.fillRect(px, py, size, size);
            }
        }

        // Draw player arrow (triangle pointing in look direction)
        this.ctx.save();
        this.ctx.translate(centerX, centerY);

        // yaw is rotation around Y axis. Convert to 2D rotation.
        // In our world: 0 yaw = looking -Z, increases counterclockwise
        const angle = playerYaw;
        this.ctx.rotate(angle);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        this.ctx.moveTo(0, -6);   // tip (forward)
        this.ctx.lineTo(-4, 4);   // bottom left
        this.ctx.lineTo(4, 4);    // bottom right
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.restore();

        // Border circle clip effect (optional - draw circle border)
        this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, MAP_SIZE / 2 - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
}

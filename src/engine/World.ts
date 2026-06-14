/**
 * World manager - stores chunks in a Map and provides unified block access.
 * This is the SINGLE ENTRY POINT for all block read/write operations.
 */

import { Chunk } from './Chunk';
import { TerrainGenerator } from './TerrainGenerator';
import { isSolid } from '../blocks/BlockType';
import {
    CHUNK_SIZE,
    CHUNK_HEIGHT,
    chunkKey,
    worldToChunk,
    worldToLocal,
    WORLD_BOUNDARY,
} from '../utils/math';

export class World {
    private chunks = new Map<string, Chunk>();
    private terrainGenerator: TerrainGenerator;
    private modifications = new Map<string, number>();

    constructor(terrainGenerator: TerrainGenerator) {
        this.terrainGenerator = terrainGenerator;
    }

    /** Get chunk by chunk coordinates */
    getChunk(cx: number, cz: number): Chunk | undefined {
        return this.chunks.get(chunkKey(cx, cz));
    }

    /** Load (or get existing) chunk at chunk coordinates */
    loadChunk(cx: number, cz: number): Chunk {
        const key = chunkKey(cx, cz);
        let chunk = this.chunks.get(key);
        if (!chunk) {
            chunk = new Chunk(cx, cz);
            this.terrainGenerator.generateChunk(chunk);
            this.applyModifications(chunk);
            this.chunks.set(key, chunk);
        }
        return chunk;
    }

    /** Unload chunk and free resources */
    unloadChunk(cx: number, cz: number): void {
        const key = chunkKey(cx, cz);
        const chunk = this.chunks.get(key);
        if (chunk) {
            chunk.dispose();
            this.chunks.delete(key);
        }
    }

    /**
     * Get block at WORLD coordinates.
     * Returns 0 (Air) for unloaded chunks, out-of-bounds Y, and world boundary.
     */
    getBlock(wx: number, wy: number, wz: number): number {
        // World boundary check
        if (Math.abs(wx) > WORLD_BOUNDARY || Math.abs(wz) > WORLD_BOUNDARY) {
            return 0;
        }
        // Y bounds check
        if (wy < 0 || wy >= CHUNK_HEIGHT) {
            return 0;
        }
        const cx = worldToChunk(wx);
        const cz = worldToChunk(wz);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) {
            return 0; // Unloaded chunk = air (safe default)
        }
        const lx = worldToLocal(wx);
        const lz = worldToLocal(wz);
        return chunk.getBlock(lx, wy, lz);
    }

    /**
     * Set block at WORLD coordinates.
     * Marks the chunk (and neighbors if on boundary) as dirty.
     */
    setBlock(wx: number, wy: number, wz: number, id: number): void {
        if (Math.abs(wx) > WORLD_BOUNDARY || Math.abs(wz) > WORLD_BOUNDARY) {
            return; // Out of world bounds
        }
        if (wy < 0 || wy >= CHUNK_HEIGHT) {
            return;
        }

        const cx = worldToChunk(wx);
        const cz = worldToChunk(wz);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) {
            return;
        }

        const lx = worldToLocal(wx);
        const lz = worldToLocal(wz);
        chunk.setBlock(lx, wy, lz, id);
        this.modifications.set(`${wx},${wy},${wz}`, id);

        if (lx === 0) {
            const neighbor = this.getChunk(cx - 1, cz);
            neighbor?.markDirty();
        }
        if (lx === CHUNK_SIZE - 1) {
            const neighbor = this.getChunk(cx + 1, cz);
            neighbor?.markDirty();
        }
        if (lz === 0) {
            const neighbor = this.getChunk(cx, cz - 1);
            neighbor?.markDirty();
        }
        if (lz === CHUNK_SIZE - 1) {
            const neighbor = this.getChunk(cx, cz + 1);
            neighbor?.markDirty();
        }
    }

    /** Get all loaded chunks */
    getLoadedChunks(): Chunk[] {
        return Array.from(this.chunks.values());
    }

    /** Get chunk count */
    get chunkCount(): number {
        return this.chunks.size;
    }

    /** Check if a world position has a solid block */
    isSolidAt(wx: number, wy: number, wz: number): boolean {
        const id = this.getBlock(wx, wy, wz);
        return isSolid(id);
    }

    private applyModifications(chunk: Chunk): void {
        for (const [key, blockId] of this.modifications) {
            const [wx, wy, wz] = key.split(',').map(Number);
            const cx = worldToChunk(wx);
            const cz = worldToChunk(wz);
            if (cx !== chunk.cx || cz !== chunk.cz) continue;
            const lx = worldToLocal(wx);
            const lz = worldToLocal(wz);
            chunk.setBlock(lx, wy, lz, blockId);
        }
    }

    getModifications(): Map<string, number> {
        return this.modifications;
    }

    setModifications(mods: Map<string, number>): void {
        this.modifications = mods;
    }
}

/**
 * Chunk manager - handles dynamic chunk loading/unloading and mesh rebuilding.
 * Processes dirty chunks with per-frame budget to prevent frame drops.
 */

import * as THREE from 'three';
import { World } from './World';
import { Chunk } from './Chunk';
import { buildChunkMesh } from './MeshBuilder';
import { worldToChunk } from '../utils/math';
import { isAffectedByGravity } from '../blocks/BlockType';

const RENDER_RADIUS = 4;
const SPAWN_RADIUS = 2;
const MAX_MESH_BUILDS_PER_FRAME = 3;
const MAX_FALLS_PER_FRAME = 10;

export class ChunkManager {
    private world: World;
    private scene: THREE.Scene;

    private lastPlayerChunkX = Infinity;
    private lastPlayerChunkZ = Infinity;

    private dirtyQueue: Chunk[] = [];
    private loadQueue: { cx: number; cz: number }[] = [];
    private fallQueue: Set<string> = new Set();

    constructor(world: World, scene: THREE.Scene) {
        this.world = world;
        this.scene = scene;
    }

    /** Synchronously load chunks around spawn point (prevents falling) */
    initialLoad(worldX: number, worldZ: number): void {
        const ccx = worldToChunk(worldX);
        const ccz = worldToChunk(worldZ);

        for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
            for (let dz = -SPAWN_RADIUS; dz <= SPAWN_RADIUS; dz++) {
                const chunk = this.world.loadChunk(ccx + dx, ccz + dz);
                this.rebuildMesh(chunk);
            }
        }

        this.lastPlayerChunkX = ccx;
        this.lastPlayerChunkZ = ccz;
    }

    /** Called each frame to update chunk loading based on player position */
    update(playerWorldX: number, playerWorldZ: number): void {
        const ccx = worldToChunk(playerWorldX);
        const ccz = worldToChunk(playerWorldZ);

        // Only recalculate if player moved to a new chunk
        if (ccx !== this.lastPlayerChunkX || ccz !== this.lastPlayerChunkZ) {
            this.updateLoadedChunks(ccx, ccz);
            this.lastPlayerChunkX = ccx;
            this.lastPlayerChunkZ = ccz;
        }

        this.processLoadQueue();
        this.processDirtyQueue();
        this.processFallQueue();
    }

    /** Load/unload chunks based on new player position */
    private updateLoadedChunks(ccx: number, ccz: number): void {
        // Determine which chunks should be loaded
        const shouldLoad = new Set<string>();
        const newChunks: { cx: number; cz: number }[] = [];

        for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
            for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
                const cx = ccx + dx;
                const cz = ccz + dz;
                shouldLoad.add(`${cx},${cz}`);
                if (!this.world.getChunk(cx, cz)) {
                    newChunks.push({ cx, cz });
                }
            }
        }

        // Sort new chunks by distance from player (closest first)
        newChunks.sort((a, b) => {
            const distA = (a.cx - ccx) ** 2 + (a.cz - ccz) ** 2;
            const distB = (b.cx - ccx) ** 2 + (b.cz - ccz) ** 2;
            return distA - distB;
        });

        this.loadQueue = newChunks;

        // Unload chunks outside render radius
        for (const chunk of this.world.getLoadedChunks()) {
            const key = `${chunk.cx},${chunk.cz}`;
            if (!shouldLoad.has(key)) {
                this.removeChunkFromScene(chunk);
                this.world.unloadChunk(chunk.cx, chunk.cz);
            }
        }
    }

    /** Process chunk load queue */
    private processLoadQueue(): void {
        let loaded = 0;
        while (this.loadQueue.length > 0 && loaded < MAX_MESH_BUILDS_PER_FRAME) {
            const { cx, cz } = this.loadQueue.shift()!;
            const chunk = this.world.loadChunk(cx, cz);
            this.rebuildMesh(chunk);
            loaded++;
        }
    }

    /** Process dirty chunk queue */
    private processDirtyQueue(): void {
        let processed = 0;

        while (this.dirtyQueue.length > 0 && processed < MAX_MESH_BUILDS_PER_FRAME) {
            const chunk = this.dirtyQueue.shift()!;
            if (chunk.dirty) {
                this.rebuildMesh(chunk);
                processed++;
            }
        }

        if (processed < MAX_MESH_BUILDS_PER_FRAME) {
            for (const chunk of this.world.getLoadedChunks()) {
                if (chunk.dirty) {
                    this.rebuildMesh(chunk);
                    processed++;
                    if (processed >= MAX_MESH_BUILDS_PER_FRAME) break;
                }
            }
        }
    }

    /** Mark a chunk as needing mesh rebuild */
    markDirty(chunk: Chunk): void {
        if (!this.dirtyQueue.includes(chunk)) {
            this.dirtyQueue.push(chunk);
        }
    }

    /** Rebuild the mesh for a chunk */
    private rebuildMesh(chunk: Chunk): void {
        // Remove old meshes from scene
        this.removeChunkFromScene(chunk);

        // Build new meshes
        const { opaque, transparent } = buildChunkMesh(chunk, this.world);

        chunk.mesh = opaque;
        chunk.transparentMesh = transparent;

        if (opaque) this.scene.add(opaque);
        if (transparent) this.scene.add(transparent);

        chunk.markClean();
    }

    /** Remove chunk meshes from scene */
    private removeChunkFromScene(chunk: Chunk): void {
        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh = null;
        }
        if (chunk.transparentMesh) {
            this.scene.remove(chunk.transparentMesh);
            chunk.transparentMesh.geometry.dispose();
            chunk.transparentMesh = null;
        }
    }

    markDirtyAt(worldX: number, _worldY: number, worldZ: number): void {
        const cx = worldToChunk(worldX);
        const cz = worldToChunk(worldZ);
        const chunk = this.world.getChunk(cx, cz);
        if (chunk) {
            this.markDirty(chunk);
        }
        this.queueFallCheck(worldX, _worldY + 1, worldZ);
    }

    queueFallCheck(x: number, y: number, z: number): void {
        this.fallQueue.add(`${x},${y},${z}`);
    }

    private processFallQueue(): void {
        let processed = 0;
        const entries = Array.from(this.fallQueue);
        this.fallQueue.clear();

        for (const entry of entries) {
            if (processed >= MAX_FALLS_PER_FRAME) {
                this.fallQueue.add(entry);
                continue;
            }

            const [x, y, z] = entry.split(',').map(Number);
            const blockId = this.world.getBlock(x, y, z);

            if (!isAffectedByGravity(blockId)) continue;

            const belowId = this.world.getBlock(x, y - 1, z);
            if (belowId !== 0) continue;

            const targetChunk = this.world.getChunk(worldToChunk(x), worldToChunk(z));
            if (!targetChunk) continue;

            this.world.setBlock(x, y, z, 0);
            this.world.setBlock(x, y - 1, z, blockId);
            this.markDirtyAt(x, y, z);
            this.markDirtyAt(x, y - 1, z);

            this.queueFallCheck(x, y - 1, z);
            this.queueFallCheck(x, y + 1, z);
            processed++;
        }
    }
}

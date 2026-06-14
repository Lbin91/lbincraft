/**
 * Chunk data structure - stores block IDs in a flat Uint8Array.
 */

import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '../utils/math';

export class Chunk {
    /** Chunk X coordinate (in chunk space) */
    readonly cx: number;
    /** Chunk Z coordinate (in chunk space) */
    readonly cz: number;

    /** Block data: 16*16*64 = 16384 bytes */
    readonly blocks: Uint8Array;

    /** Whether the mesh needs to be rebuilt */
    dirty: boolean = true;

    /** Opaque mesh (dirt, stone, grass, etc.) */
    mesh: THREE.Mesh | null = null;

    /** Transparent mesh (leaves, water) */
    transparentMesh: THREE.Mesh | null = null;

    /** Whether this chunk has been generated (terrain applied) */
    generated: boolean = false;

    constructor(cx: number, cz: number) {
        this.cx = cx;
        this.cz = cz;
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    }

    /** Get block ID at local coordinates */
    getBlock(x: number, y: number, z: number): number {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return 0; // Air for out-of-bounds
        }
        return this.blocks[blockIndex(x, y, z)];
    }

    /** Set block ID at local coordinates */
    setBlock(x: number, y: number, z: number, id: number): void {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return;
        }
        this.blocks[blockIndex(x, y, z)] = id;
        this.dirty = true;
    }

    /** Mark this chunk as needing a mesh rebuild */
    markDirty(): void {
        this.dirty = true;
    }

    markClean(): void {
        this.dirty = false;
    }

    /** Dispose Three.js meshes to free GPU memory */
    dispose(): void {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.transparentMesh) {
            this.transparentMesh.geometry.dispose();
            this.transparentMesh = null;
        }
    }

    /** World X offset for this chunk */
    get worldX(): number {
        return this.cx * CHUNK_SIZE;
    }

    /** World Z offset for this chunk */
    get worldZ(): number {
        return this.cz * CHUNK_SIZE;
    }
}

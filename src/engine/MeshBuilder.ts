/**
 * Mesh builder - creates BufferGeometry for chunks with face culling.
 * Uses vertex colors (no texture atlas needed) with per-face shading.
 * Builds separate opaque and transparent meshes per chunk.
 */

import * as THREE from 'three';
import { Chunk } from './Chunk';
import { World } from './World';
import { BlockId, isTransparent, getBlockType } from '../blocks/BlockType';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../utils/math';

interface FaceDef {
    normal: [number, number, number];
    corners: [number, number, number][];
    neighbor: [number, number, number];
    shade: number; // brightness multiplier for fake AO
}

// 6 cube faces - corners in CCW order from outside, verified normals via cross product
const FACES: FaceDef[] = [
    { // +X (east)
        normal: [1, 0, 0],
        corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
        neighbor: [1, 0, 0],
        shade: 0.6,
    },
    { // -X (west)
        normal: [-1, 0, 0],
        corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
        neighbor: [-1, 0, 0],
        shade: 0.6,
    },
    { // +Y (top)
        normal: [0, 1, 0],
        corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
        neighbor: [0, 1, 0],
        shade: 1.0,
    },
    { // -Y (bottom)
        normal: [0, -1, 0],
        corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
        neighbor: [0, -1, 0],
        shade: 0.5,
    },
    { // +Z (south)
        normal: [0, 0, 1],
        corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
        neighbor: [0, 0, 1],
        shade: 0.8,
    },
    { // -Z (north)
        normal: [0, 0, -1],
        corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
        neighbor: [0, 0, -1],
        shade: 0.8,
    },
];

// Shared materials
let opaqueMaterial: THREE.MeshLambertMaterial | null = null;
let transparentMaterial: THREE.MeshLambertMaterial | null = null;

function getOpaqueMaterial(): THREE.MeshLambertMaterial {
    if (!opaqueMaterial) {
        opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
    return opaqueMaterial;
}

function getTransparentMaterial(): THREE.MeshLambertMaterial {
    if (!transparentMaterial) {
        transparentMaterial = new THREE.MeshLambertMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
    }
    return transparentMaterial;
}

/** Parse hex color "#rrggbb" to RGB [0-1] */
function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

/** Determine if a face should be rendered given the neighbor block */
function isFaceVisible(currentBlock: number, neighborBlock: number): boolean {
    if (neighborBlock === BlockId.Air) return true;
    if (!isTransparent(neighborBlock)) return false;
    // Neighbor is transparent
    if (neighborBlock === currentBlock) return false; // same type, no internal face
    return true;
}

interface MeshData {
    positions: number[];
    normals: number[];
    colors: number[];
    indices: number[];
}

function newMeshData(): MeshData {
    return { positions: [], normals: [], colors: [], indices: [] };
}

/**
 * Build geometry for a chunk.
 * Returns opaque and transparent meshes.
 */
export function buildChunkMesh(chunk: Chunk, world: World): {
    opaque: THREE.Mesh | null;
    transparent: THREE.Mesh | null;
} {
    const opaqueData = newMeshData();
    const transparentData = newMeshData();

    const worldOffsetX = chunk.cx * CHUNK_SIZE;
    const worldOffsetZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const blockId = chunk.getBlock(x, y, z);
                if (blockId === BlockId.Air) continue;

                const blockType = getBlockType(blockId as BlockId);
                const isTransparentBlock = blockType.transparent;
                const targetData = isTransparentBlock ? transparentData : opaqueData;

                const wx = worldOffsetX + x;
                const wz = worldOffsetZ + z;

                for (const face of FACES) {
                    const neighborBlock = world.getBlock(
                        wx + face.neighbor[0],
                        y + face.neighbor[1],
                        wz + face.neighbor[2]
                    );

                    if (!isFaceVisible(blockId, neighborBlock)) continue;

                    // Determine color based on face direction
                    let colorHex: string;
                    if (face.normal[1] === 1) colorHex = blockType.colors.top;
                    else if (face.normal[1] === -1) colorHex = blockType.colors.bottom;
                    else colorHex = blockType.colors.side;

                    const [r, g, b] = hexToRgb(colorHex);
                    const shade = face.shade;

                    // Add 4 vertices
                    const baseIndex = targetData.positions.length / 3;
                    for (const corner of face.corners) {
                        targetData.positions.push(x + corner[0], y + corner[1], z + corner[2]);
                        targetData.normals.push(face.normal[0], face.normal[1], face.normal[2]);
                        targetData.colors.push(r * shade, g * shade, b * shade);
                    }

                    // Add 2 triangles (6 indices)
                    targetData.indices.push(
                        baseIndex, baseIndex + 1, baseIndex + 2,
                        baseIndex, baseIndex + 2, baseIndex + 3
                    );
                }
            }
        }
    }

    const opaqueMesh = createMesh(opaqueData, getOpaqueMaterial());
    const transparentMesh = createMesh(transparentData, getTransparentMaterial());

    // Set world position
    if (opaqueMesh) {
        opaqueMesh.position.set(worldOffsetX, 0, worldOffsetZ);
    }
    if (transparentMesh) {
        transparentMesh.position.set(worldOffsetX, 0, worldOffsetZ);
    }

    return { opaque: opaqueMesh, transparent: transparentMesh };
}

function createMesh(data: MeshData, material: THREE.Material): THREE.Mesh | null {
    if (data.indices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setIndex(data.indices);
    geometry.computeBoundingSphere();

    return new THREE.Mesh(geometry, material);
}

/** Dispose shared materials (call on game shutdown) */
export function disposeMaterials(): void {
    opaqueMaterial?.dispose();
    transparentMaterial?.dispose();
    opaqueMaterial = null;
    transparentMaterial = null;
}

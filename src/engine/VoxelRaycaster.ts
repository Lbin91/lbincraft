/**
 * Voxel raycaster using DDA (Digital Differential Analyzer) algorithm.
 * Amanatides & Woo (1987) voxel traversal for fast block selection.
 */

import * as THREE from 'three';
import { World } from './World';
import { isSolid } from '../blocks/BlockType';

export interface RaycastResult {
    hit: boolean;
    /** World coordinates of the hit block */
    block: THREE.Vector3;
    /** Normal of the hit face (direction pointing away from block) */
    normal: THREE.Vector3;
}

/**
 * Cast a ray through the voxel grid and find the first solid block.
 * @param origin Ray origin (world coordinates)
 * @param direction Ray direction (normalized)
 * @param maxDistance Maximum ray distance in blocks
 * @param world World to raycast against
 */
export function raycastVoxel(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    world: World
): RaycastResult {
    // Current voxel coordinates
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    // Direction signs (+1 or -1)
    const stepX = direction.x > 0 ? 1 : -1;
    const stepY = direction.y > 0 ? 1 : -1;
    const stepZ = direction.z > 0 ? 1 : -1;

    // Calculate tMax: distance to next voxel boundary on each axis
    // tDelta: distance between voxel boundaries on each axis
    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    // Distance from origin to the first voxel boundary on each axis
    let tMaxX: number;
    let tMaxY: number;
    let tMaxZ: number;

    if (direction.x > 0) {
        tMaxX = (x + 1 - origin.x) / direction.x;
    } else if (direction.x < 0) {
        tMaxX = (origin.x - x) / -direction.x;
    } else {
        tMaxX = Infinity;
    }

    if (direction.y > 0) {
        tMaxY = (y + 1 - origin.y) / direction.y;
    } else if (direction.y < 0) {
        tMaxY = (origin.y - y) / -direction.y;
    } else {
        tMaxY = Infinity;
    }

    if (direction.z > 0) {
        tMaxZ = (z + 1 - origin.z) / direction.z;
    } else if (direction.z < 0) {
        tMaxZ = (origin.z - z) / -direction.z;
    } else {
        tMaxZ = Infinity;
    }

    // Normal of the last face we stepped through
    let normal = new THREE.Vector3(0, 0, 0);

    let traveled = 0;

    while (traveled <= maxDistance) {
        // Check current voxel
        const blockId = world.getBlock(x, y, z);
        if (isSolid(blockId)) {
            return {
                hit: true,
                block: new THREE.Vector3(x, y, z),
                normal: normal.clone(),
            };
        }

        // Step to next voxel (choose the axis with smallest tMax)
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
            x += stepX;
            traveled = tMaxX;
            tMaxX += tDeltaX;
            normal.set(-stepX, 0, 0);
        } else if (tMaxY < tMaxZ) {
            y += stepY;
            traveled = tMaxY;
            tMaxY += tDeltaY;
            normal.set(0, -stepY, 0);
        } else {
            z += stepZ;
            traveled = tMaxZ;
            tMaxZ += tDeltaZ;
            normal.set(0, 0, -stepZ);
        }
    }

    return {
        hit: false,
        block: new THREE.Vector3(),
        normal: new THREE.Vector3(),
    };
}

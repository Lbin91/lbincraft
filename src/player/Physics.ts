/**
 * Physics engine - gravity, collision detection, and movement resolution.
 * Uses per-axis AABB collision against the voxel grid.
 */

import * as THREE from 'three';
import { Player, PLAYER_WIDTH, PLAYER_HEIGHT } from './Player';
import { World } from '../engine/World';

const GRAVITY = -30; // m/s²
const TERMINAL_VELOCITY = -50; // m/s max fall speed
const FALL_RECOVERY_Y = -10; // Teleport if player falls below this
const SUBSTEP_THRESHOLD = 4.0; // Subdivide movement if speed > this

export class Physics {
    private world: World;

    constructor(world: World) {
        this.world = world;
    }

    /**
     * Update player physics for this frame.
     * @param player Player entity
     * @param moveDir Horizontal movement direction (from controls)
     * @param delta Frame time in seconds
     */
    update(player: Player, moveDir: THREE.Vector3, delta: number): void {
        // Fall recovery: if player falls into void, teleport to surface
        if (player.position.y < FALL_RECOVERY_Y) {
            this.recoverFromFall(player);
            return;
        }

        // Apply horizontal movement (directly from input, no momentum for simplicity)
        player.velocity.x = moveDir.x;
        player.velocity.z = moveDir.z;

        // Apply gravity
        player.velocity.y += GRAVITY * delta;
        if (player.velocity.y < TERMINAL_VELOCITY) {
            player.velocity.y = TERMINAL_VELOCITY;
        }

        // Reset onGround
        player.onGround = false;

        // Substep if moving fast (prevent tunneling)
        const moveDist = Math.sqrt(
            player.velocity.x ** 2 + player.velocity.y ** 2 + player.velocity.z ** 2
        ) * delta;

        const substeps = Math.max(1, Math.ceil(moveDist / SUBSTEP_THRESHOLD));
        const subDelta = delta / substeps;

        for (let i = 0; i < substeps; i++) {
            this.moveAxis(player, 'x', subDelta);
            this.moveAxis(player, 'z', subDelta);
            this.moveAxis(player, 'y', subDelta);
        }
    }

    /** Move player along one axis and resolve collisions */
    private moveAxis(player: Player, axis: 'x' | 'y' | 'z', delta: number): void {
        const velocity = player.velocity[axis];
        if (velocity === 0) return;

        const displacement = velocity * delta;

        // Move player
        player.position[axis] += displacement;

        // Check collision
        const aabb = player.getAABB();
        if (this.checkCollision(player, aabb)) {
            // Collision detected - push player back to boundary
            if (velocity > 0) {
                // Moving in positive direction - align to block boundary
                const blockMax = Math.floor(aabb.max[axis]);
                player.position[axis] = blockMax - (axis === 'y' ? PLAYER_HEIGHT : PLAYER_WIDTH / 2);
                if (axis === 'y') {
                    // This case shouldn't happen (moving up into ceiling) but handle it
                    player.position[axis] = blockMax - PLAYER_HEIGHT - 0.001;
                }
            } else {
                // Moving in negative direction
                const blockMin = Math.floor(aabb.min[axis]);
                player.position[axis] = blockMin + 1 + (axis === 'y' ? 0 : PLAYER_WIDTH / 2);
                if (axis === 'y') {
                    player.onGround = true;
                }
            }

            // Stop velocity on this axis
            player.velocity[axis] = 0;
        }
    }

    /** Check if player AABB intersects any solid block */
    private checkCollision(_player: Player, aabb: THREE.Box3): boolean {
        const minX = Math.floor(aabb.min.x);
        const maxX = Math.floor(aabb.max.x);
        const minY = Math.floor(aabb.min.y);
        const maxY = Math.floor(aabb.max.y);
        const minZ = Math.floor(aabb.min.z);
        const maxZ = Math.floor(aabb.max.z);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.world.isSolidAt(x, y, z)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** Teleport player to surface when falling into void */
    private recoverFromFall(player: Player): void {
        const px = Math.floor(player.position.x);
        const pz = Math.floor(player.position.z);

        // Find highest solid block at this X,Z
        for (let y = 60; y >= 0; y--) {
            if (this.world.isSolidAt(px, y, pz)) {
                player.teleport(px + 0.5, y + 1, pz + 0.5);
                return;
            }
        }

        // Fallback: spawn at default height
        player.teleport(px + 0.5, 40, pz + 0.5);
    }

    /** Handle jump */
    jump(player: Player): void {
        if (player.onGround) {
            player.velocity.y = 9.0; // Jump velocity
            player.onGround = false;
        }
    }
}

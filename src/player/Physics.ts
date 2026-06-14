import * as THREE from 'three';
import { Player } from './Player';
import { World } from '../engine/World';

const GRAVITY = -30;
const TERMINAL_VELOCITY = -50;
const FALL_RECOVERY_Y = -10;
const SUBSTEP_THRESHOLD = 4.0;
const EPSILON = 0.001;

export class Physics {
    private world: World;

    constructor(world: World) {
        this.world = world;
    }

    update(player: Player, moveDir: THREE.Vector3, delta: number): void {
        if (player.position.y < FALL_RECOVERY_Y) {
            this.recoverFromFall(player);
            return;
        }

        player.velocity.x = moveDir.x;
        player.velocity.z = moveDir.z;

        player.velocity.y += GRAVITY * delta;
        if (player.velocity.y < TERMINAL_VELOCITY) {
            player.velocity.y = TERMINAL_VELOCITY;
        }

        player.onGround = false;

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

    private moveAxis(player: Player, axis: 'x' | 'y' | 'z', delta: number): void {
        const velocity = player.velocity[axis];
        if (velocity === 0) return;

        const oldPos = player.position[axis];
        player.position[axis] = oldPos + velocity * delta;

        if (this.checkCollision(player.getAABB())) {
            player.position[axis] = oldPos;

            if (axis === 'y' && velocity < 0) {
                player.onGround = true;
            }

            player.velocity[axis] = 0;
        }
    }

    private checkCollision(aabb: THREE.Box3): boolean {
        const minX = Math.floor(aabb.min.x + EPSILON);
        const maxX = Math.floor(aabb.max.x - EPSILON);
        const minY = Math.floor(aabb.min.y + EPSILON);
        const maxY = Math.floor(aabb.max.y - EPSILON);
        const minZ = Math.floor(aabb.min.z + EPSILON);
        const maxZ = Math.floor(aabb.max.z - EPSILON);

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

    private recoverFromFall(player: Player): void {
        const px = Math.floor(player.position.x);
        const pz = Math.floor(player.position.z);

        for (let y = 60; y >= 0; y--) {
            if (this.world.isSolidAt(px, y, pz)) {
                player.teleport(px + 0.5, y + 1, pz + 0.5);
                return;
            }
        }

        player.teleport(px + 0.5, 40, pz + 0.5);
    }

    jump(player: Player): void {
        if (player.onGround) {
            player.velocity.y = 9.0;
            player.onGround = false;
        }
    }
}

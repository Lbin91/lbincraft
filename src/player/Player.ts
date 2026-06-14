/**
 * Player entity - position, velocity, AABB, and state.
 */

import * as THREE from 'three';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;

export class Player {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    /** Yaw (left-right) and Pitch (up-down) in radians */
    yaw: number = 0;
    pitch: number = 0;
    onGround: boolean = false;

    constructor(x: number, y: number, z: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
    }

    /** Get the player's AABB at current position */
    getAABB(): THREE.Box3 {
        const half = PLAYER_WIDTH / 2;
        return new THREE.Box3(
            new THREE.Vector3(
                this.position.x - half,
                this.position.y,
                this.position.z - half
            ),
            new THREE.Vector3(
                this.position.x + half,
                this.position.y + PLAYER_HEIGHT,
                this.position.z + half
            )
        );
    }

    /** Get camera position (eye level) */
    getEyePosition(): THREE.Vector3 {
        return new THREE.Vector3(
            this.position.x,
            this.position.y + PLAYER_EYE_HEIGHT,
            this.position.z
        );
    }

    /** Get look direction based on yaw/pitch */
    getLookDirection(): THREE.Vector3 {
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        );
        return dir.normalize();
    }

    /** Get forward direction (horizontal only, for movement) */
    getForward(): THREE.Vector3 {
        return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    }

    /** Get right direction (horizontal only, for movement) */
    getRight(): THREE.Vector3 {
        return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    }

    /** Teleport player to position */
    teleport(x: number, y: number, z: number): void {
        this.position.set(x, y, z);
        this.velocity.set(0, 0, 0);
    }
}

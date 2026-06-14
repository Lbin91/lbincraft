/**
 * Controls - keyboard + mouse input handling.
 * Uses Pointer Lock API for mouse look.
 */

import * as THREE from 'three';
import { Player } from './Player';

export class Controls {
    private keys: Record<string, boolean> = {};
    private locked: boolean = false;
    private player: Player;
    private domElement: HTMLElement;

    // Mouse sensitivity
    readonly sensitivity = 0.002;
    // Movement speed
    readonly moveSpeed = 5.5;
    // Jump velocity
    readonly jumpSpeed = 9;

    // Pitch limits (radians)
    readonly maxPitch = Math.PI / 2 - 0.01;
    readonly minPitch = -Math.PI / 2 + 0.01;

    onMouseMove: ((deltaX: number, deltaY: number) => void) | null = null;

    constructor(player: Player, domElement: HTMLElement) {
        this.player = player;
        this.domElement = domElement;
        this.setupListeners();
    }

    private setupListeners(): void {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse movement (pointer lock)
        document.addEventListener('mousemove', (e) => {
            if (!this.locked) return;
            this.applyMouseDelta(e.movementX, e.movementY);
        });

        // Pointer lock change
        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === this.domElement;
        });
    }

    private applyMouseDelta(deltaX: number, deltaY: number): void {
        this.player.yaw -= deltaX * this.sensitivity;
        this.player.pitch -= deltaY * this.sensitivity;
        this.player.pitch = Math.max(
            this.minPitch,
            Math.min(this.maxPitch, this.player.pitch)
        );
    }

    /** Request pointer lock on the canvas element */
    lockPointer(): void {
        this.domElement.requestPointerLock();
    }

    /** Check if pointer is locked */
    isLocked(): boolean {
        return this.locked;
    }

    /** Get movement input vector (forward, right) */
    getMoveInput(): { forward: number; right: number } {
        let forward = 0;
        let right = 0;

        if (this.keys['KeyW']) forward += 1;
        if (this.keys['KeyS']) forward -= 1;
        if (this.keys['KeyD']) right += 1;
        if (this.keys['KeyA']) right -= 1;

        return { forward, right };
    }

    /** Check if jump key is pressed */
    isJumping(): boolean {
        return this.keys['Space'] ?? false;
    }

    /** Check if shift (descend/fly down) is pressed */
    isDescending(): boolean {
        return this.keys['ShiftLeft'] ?? false;
    }

    /** Get the horizontal movement direction in world space */
    getMoveDirection(): THREE.Vector3 {
        const { forward, right } = this.getMoveInput();
        const fwd = this.player.getForward();
        const rgt = this.player.getRight();

        const dir = new THREE.Vector3();
        dir.addScaledVector(fwd, forward);
        dir.addScaledVector(rgt, right);

        // Normalize if magnitude > 1 (diagonal movement)
        if (dir.lengthSq() > 1) {
            dir.normalize();
        }

        return dir.multiplyScalar(this.moveSpeed);
    }
}

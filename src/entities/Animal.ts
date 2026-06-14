import * as THREE from 'three';
import { Entity } from './Entity';
import { World } from '../engine/World';

export class Pig extends Entity {
    private wanderTimer: number = 0;
    private wanderDir: THREE.Vector3 = new THREE.Vector3();
    private fleeTimer: number = 0;

    constructor(id: number, x: number, y: number, z: number) {
        super(id, x, y, z, 0.9, 0.6, 10);
        this.buildMesh();
    }

    private buildMesh(): void {
        this.addBox(0.8, 0.5, 0.5, 0, 0.35, 0, 0xe0a0a0);
        this.addBox(0.4, 0.4, 0.3, 0, 0.4, -0.5, 0xe0a0a0);
        this.addBox(0.15, 0.3, 0.15, -0.25, -0.1, 0.25, 0xd09090, true);
        this.addBox(0.15, 0.3, 0.15, 0.25, -0.1, 0.25, 0xd09090, true);
        this.addBox(0.15, 0.3, 0.15, -0.25, -0.1, -0.25, 0xd09090, true);
        this.addBox(0.15, 0.3, 0.15, 0.25, -0.1, -0.25, 0xd09090, true);
    }

    update(delta: number, world: World, playerPosition: THREE.Vector3): void {
        const distToPlayer = this.position.distanceTo(playerPosition);

        if (distToPlayer < 5) {
            const flee = this.position.clone().sub(playerPosition).normalize();
            this.velocity.x = flee.x * 3;
            this.velocity.z = flee.z * 3;
            this.rotation = Math.atan2(flee.x, flee.z);
            this.fleeTimer = 2.0;
        } else if (this.fleeTimer > 0) {
            this.fleeTimer -= delta;
        } else {
            this.wanderTimer -= delta;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 3 + Math.random() * 3;
                if (Math.random() < 0.4) {
                    this.wanderDir.set(0, 0, 0);
                } else {
                    const angle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                    this.rotation = angle;
                }
            }
            this.velocity.x = this.wanderDir.x * 1.5;
            this.velocity.z = this.wanderDir.z * 1.5;
        }

        this.updatePhysics(delta, world);
    }
}

export class Chicken extends Entity {
    private wanderTimer: number = 0;
    private wanderDir: THREE.Vector3 = new THREE.Vector3();
    private fleeTimer: number = 0;

    constructor(id: number, x: number, y: number, z: number) {
        super(id, x, y, z, 0.4, 0.5, 6);
        this.buildMesh();
    }

    private buildMesh(): void {
        this.addBox(0.35, 0.3, 0.3, 0, 0.25, 0, 0xffffff);
        this.addBox(0.2, 0.2, 0.2, 0, 0.55, -0.2, 0xffffff);
        this.addBox(0.08, 0.08, 0.1, 0, 0.58, -0.35, 0xff8800);
        this.addBox(0.1, 0.2, 0.1, -0.08, -0.05, 0, 0xff8800, true);
        this.addBox(0.1, 0.2, 0.1, 0.08, -0.05, 0, 0xff8800, true);
    }

    update(delta: number, world: World, playerPosition: THREE.Vector3): void {
        const distToPlayer = this.position.distanceTo(playerPosition);

        if (distToPlayer < 4) {
            const flee = this.position.clone().sub(playerPosition).normalize();
            this.velocity.x = flee.x * 2.5;
            this.velocity.z = flee.z * 2.5;
            this.rotation = Math.atan2(flee.x, flee.z);
            this.fleeTimer = 2.0;
        } else if (this.fleeTimer > 0) {
            this.fleeTimer -= delta;
        } else {
            this.wanderTimer -= delta;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2 + Math.random() * 2;
                if (Math.random() < 0.5) {
                    this.wanderDir.set(0, 0, 0);
                } else {
                    const angle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                    this.rotation = angle;
                }
            }
            this.velocity.x = this.wanderDir.x * 1.2;
            this.velocity.z = this.wanderDir.z * 1.2;
        }

        this.updatePhysics(delta, world);
    }
}

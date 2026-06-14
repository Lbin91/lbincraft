import * as THREE from 'three';
import { Entity } from './Entity';
import { World } from '../engine/World';
import { Survival, DamageSource } from '../player/Survival';

export class Zombie extends Entity {
    private attackCooldown: number = 0;

    constructor(id: number, x: number, y: number, z: number) {
        super(id, x, y, z, 0.6, 1.7, 20);
        this.buildMesh();
    }

    private buildMesh(): void {
        this.addBox(0.5, 0.7, 0.25, 0, 1.05, 0, 0x4a7a3a);
        this.addBox(0.4, 0.4, 0.4, 0, 1.6, 0, 0x5a8a4a);
        this.addBox(0.15, 0.6, 0.15, -0.35, 1.1, 0, 0x4a7a3a);
        this.addBox(0.15, 0.6, 0.15, 0.35, 1.1, 0, 0x4a7a3a);
        this.addBox(0.2, 0.8, 0.2, -0.15, 0.4, 0, 0x3a5a2a, true);
        this.addBox(0.2, 0.8, 0.2, 0.15, 0.4, 0, 0x3a5a2a, true);
    }

    update(delta: number, world: World, playerPosition: THREE.Vector3): void {
        const distToPlayer = this.position.distanceTo(playerPosition);
        this.attackCooldown -= delta;

        if (distToPlayer < 20) {
            const dir = this.position.clone().sub(playerPosition).normalize().negate();
            this.velocity.x = dir.x * 2.5;
            this.velocity.z = dir.z * 2.5;
            this.rotation = Math.atan2(dir.x, dir.z);

            if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.0;
            }
        } else {
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }

        this.updatePhysics(delta, world);
    }

    tryAttack(playerPosition: THREE.Vector3, survival: Survival): boolean {
        const dist = this.position.distanceTo(playerPosition);
        if (dist < 1.5 && this.attackCooldown <= 0) {
            survival.takeDamage(3, DamageSource.Fall);
            this.attackCooldown = 1.0;
            return true;
        }
        return false;
    }
}

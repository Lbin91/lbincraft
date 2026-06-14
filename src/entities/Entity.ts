import * as THREE from 'three';
import { World } from '../engine/World';
import { isSolid } from '../blocks/BlockType';

export abstract class Entity {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: number = 0;
    health: number;
    maxHealth: number;
    width: number;
    height: number;
    mesh: THREE.Group;
    dead: boolean = false;
    onGround: boolean = false;

    private walkCycle: number = 0;
    private legs: THREE.Mesh[] = [];

    constructor(id: number, x: number, y: number, z: number, width: number, height: number, health: number) {
        this.id = id;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3();
        this.width = width;
        this.height = height;
        this.health = health;
        this.maxHealth = health;
        this.mesh = new THREE.Group();
    }

    protected addBox(
        w: number, h: number, d: number,
        x: number, y: number, z: number,
        color: number,
        isLeg: boolean = false
    ): THREE.Mesh {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.mesh.add(mesh);
        if (isLeg) this.legs.push(mesh);
        return mesh;
    }

    protected updatePhysics(delta: number, world: World): void {
        this.velocity.y += -30 * delta;
        if (this.velocity.y < -50) this.velocity.y = -50;

        this.position.x += this.velocity.x * delta;
        this.resolveCollisionX(world);
        this.position.z += this.velocity.z * delta;
        this.resolveCollisionZ(world);
        this.position.y += this.velocity.y * delta;
        this.resolveCollisionY(world);

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (speed > 0.1 && this.onGround) {
            this.walkCycle += delta * speed * 8;
            const swing = Math.sin(this.walkCycle) * 0.5;
            this.legs.forEach((leg, i) => {
                leg.rotation.x = i % 2 === 0 ? swing : -swing;
            });
        } else {
            this.legs.forEach(leg => { leg.rotation.x *= 0.8; });
        }
    }

    private isSolidAt(world: World, x: number, y: number, z: number): boolean {
        const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if (id === 0) return false;
        return isSolid(id);
    }

    private resolveCollisionX(world: World): void {
        const half = this.width / 2;
        const minX = Math.floor(this.position.x - half);
        const maxX = Math.floor(this.position.x + half);
        const minY = Math.floor(this.position.y);
        const maxY = Math.floor(this.position.y + this.height);
        const minZ = Math.floor(this.position.z - half);
        const maxZ = Math.floor(this.position.z + half);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.isSolidAt(world, x, y, z)) {
                        if (this.velocity.x > 0) {
                            this.position.x = x - half - 0.001;
                        } else if (this.velocity.x < 0) {
                            this.position.x = x + 1 + half + 0.001;
                        }
                        this.velocity.x = 0;
                        return;
                    }
                }
            }
        }
    }

    private resolveCollisionZ(world: World): void {
        const half = this.width / 2;
        const minX = Math.floor(this.position.x - half);
        const maxX = Math.floor(this.position.x + half);
        const minY = Math.floor(this.position.y);
        const maxY = Math.floor(this.position.y + this.height);
        const minZ = Math.floor(this.position.z - half);
        const maxZ = Math.floor(this.position.z + half);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.isSolidAt(world, x, y, z)) {
                        if (this.velocity.z > 0) {
                            this.position.z = z - half - 0.001;
                        } else if (this.velocity.z < 0) {
                            this.position.z = z + 1 + half + 0.001;
                        }
                        this.velocity.z = 0;
                        return;
                    }
                }
            }
        }
    }

    private resolveCollisionY(world: World): void {
        const half = this.width / 2;
        const minX = Math.floor(this.position.x - half);
        const maxX = Math.floor(this.position.x + half);
        const minY = Math.floor(this.position.y);
        const maxY = Math.floor(this.position.y + this.height);
        const minZ = Math.floor(this.position.z - half);
        const maxZ = Math.floor(this.position.z + half);

        this.onGround = false;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.isSolidAt(world, x, y, z)) {
                        if (this.velocity.y > 0) {
                            this.position.y = y - this.height - 0.001;
                        } else if (this.velocity.y < 0) {
                            this.position.y = y + 1 + 0.001;
                            this.onGround = true;
                        }
                        this.velocity.y = 0;
                        return;
                    }
                }
            }
        }
    }

    abstract update(delta: number, world: World, playerPosition: THREE.Vector3): void;

    takeDamage(amount: number): void {
        this.health -= amount;
        if (this.health <= 0) this.dead = true;
    }

    dispose(): void {
        this.mesh.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        });
    }
}

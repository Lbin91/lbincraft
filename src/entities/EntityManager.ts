import * as THREE from 'three';
import { Entity } from './Entity';
import { Pig, Chicken } from './Animal';
import { Zombie } from './Zombie';
import { World } from '../engine/World';

const MAX_ANIMALS = 12;
const MAX_ZOMBIES = 6;
const SPAWN_DISTANCE_MIN = 12;
const SPAWN_DISTANCE_MAX = 28;
const DESPAWN_DISTANCE = 60;

export class EntityManager {
    private entities: Entity[] = [];
    private scene: THREE.Scene;
    private world: World;
    private nextId: number = 0;

    private animalSpawnTimer: number = 0;
    private zombieSpawnTimer: number = 0;

    constructor(scene: THREE.Scene, world: World) {
        this.scene = scene;
        this.world = world;
    }

    get count(): number {
        return this.entities.length;
    }

    get animals(): Entity[] {
        return this.entities.filter(e => !(e instanceof Zombie));
    }

    get zombies(): Zombie[] {
        return this.entities.filter(e => e instanceof Zombie) as Zombie[];
    }

    update(delta: number, world: World, playerPosition: THREE.Vector3, playerYaw: number, isNight: boolean): void {
        this.updateSpawning(delta, playerPosition, playerYaw, isNight);

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            entity.update(delta, world, playerPosition);

            if (entity.position.distanceTo(playerPosition) > DESPAWN_DISTANCE) {
                this.removeEntity(entity);
            }

            if (entity.dead) {
                this.removeEntity(entity);
            }
        }
    }

    private updateSpawning(delta: number, playerPosition: THREE.Vector3, playerYaw: number, isNight: boolean): void {
        const animalCount = this.animals.length;
        const zombieCount = this.zombies.length;

        this.animalSpawnTimer -= delta;
        if (this.animalSpawnTimer <= 0 && animalCount < MAX_ANIMALS) {
            this.animalSpawnTimer = 3 + Math.random() * 4;
            this.spawnAnimal(playerPosition, playerYaw);
        }

        if (isNight) {
            this.zombieSpawnTimer -= delta;
            if (this.zombieSpawnTimer <= 0 && zombieCount < MAX_ZOMBIES) {
                this.zombieSpawnTimer = 5 + Math.random() * 5;
                this.spawnZombie(playerPosition, playerYaw);
            }
        }
    }

    private spawnAnimal(playerPosition: THREE.Vector3, playerYaw: number): void {
        const pos = this.findSpawnPosition(playerPosition, playerYaw);
        if (!pos) return;

        const type = Math.random() < 0.6 ? 'pig' : 'chicken';
        const entity = type === 'pig'
            ? new Pig(this.nextId++, pos.x, pos.y, pos.z)
            : new Chicken(this.nextId++, pos.x, pos.y, pos.z);

        this.scene.add(entity.mesh);
        this.entities.push(entity);
    }

    private spawnZombie(playerPosition: THREE.Vector3, playerYaw: number): void {
        const pos = this.findSpawnPosition(playerPosition, playerYaw);
        if (!pos) return;

        const zombie = new Zombie(this.nextId++, pos.x, pos.y, pos.z);
        this.scene.add(zombie.mesh);
        this.entities.push(zombie);
    }

    private findSpawnPosition(playerPosition: THREE.Vector3, playerYaw: number): THREE.Vector3 | null {
        for (let attempt = 0; attempt < 10; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const angleDiff = Math.abs(((angle - playerYaw + Math.PI) % (Math.PI * 2)) - Math.PI);
            if (angleDiff < Math.PI / 3) continue;

            const dist = SPAWN_DISTANCE_MIN + Math.random() * (SPAWN_DISTANCE_MAX - SPAWN_DISTANCE_MIN);
            const x = Math.floor(playerPosition.x + Math.cos(angle) * dist);
            const z = Math.floor(playerPosition.z + Math.sin(angle) * dist);

            for (let y = 50; y >= 1; y--) {
                if (this.world.isSolidAt(x, y, z) && !this.world.isSolidAt(x, y + 1, z) && !this.world.isSolidAt(x, y + 2, z)) {
                    return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
                }
            }
        }
        return null;
    }

    private removeEntity(entity: Entity): void {
        this.scene.remove(entity.mesh);
        entity.dispose();
        const idx = this.entities.indexOf(entity);
        if (idx >= 0) this.entities.splice(idx, 1);
    }

    handleBlockClick(origin: THREE.Vector3, direction: THREE.Vector3): Entity | null {
        let closestEntity: Entity | null = null;
        let closestDist = Infinity;

        for (const entity of this.entities) {
            const center = entity.position.clone();
            center.y += entity.height / 2;
            const toEntity = center.clone().sub(origin);
            const proj = toEntity.dot(direction);

            if (proj < 0 || proj > 5) continue;

            const closestPoint = origin.clone().add(direction.clone().multiplyScalar(proj));
            const distToRay = closestPoint.distanceTo(center);

            if (distToRay < Math.max(entity.width, entity.height) / 2 + 0.3 && proj < closestDist) {
                closestDist = proj;
                closestEntity = entity;
            }
        }

        return closestEntity;
    }

    damageEntity(entity: Entity, amount: number): void {
        entity.takeDamage(amount);
    }

    dispose(): void {
        for (const entity of this.entities) {
            this.scene.remove(entity.mesh);
            entity.dispose();
        }
        this.entities = [];
    }
}

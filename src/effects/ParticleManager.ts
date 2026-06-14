import * as THREE from 'three';
import { getBlockType, BlockId } from '../blocks/BlockType';

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
}

const MAX_PARTICLES = 100;
const GRAVITY = -15;
const PARTICLE_SIZE = 0.15;

export class ParticleManager {
    private particles: Particle[] = [];
    private scene: THREE.Scene;
    private geometry: THREE.BoxGeometry;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geometry = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    }

    spawnBlockBreak(x: number, y: number, z: number, blockId: BlockId): void {
        if (this.particles.length >= MAX_PARTICLES) {
            const oldest = this.particles.shift();
            if (oldest) {
                this.scene.remove(oldest.mesh);
                (oldest.mesh.material as THREE.Material).dispose();
            }
        }

        const blockType = getBlockType(blockId);
        const color = new THREE.Color(blockType.colors.top);
        const count = 8 + Math.floor(Math.random() * 4);

        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshBasicMaterial({
                color: color.clone(),
                transparent: true,
                depthWrite: false,
            });

            const mesh = new THREE.Mesh(this.geometry, material);
            mesh.position.set(
                x + 0.5 + (Math.random() - 0.5) * 0.6,
                y + 0.5 + (Math.random() - 0.5) * 0.6,
                z + 0.5 + (Math.random() - 0.5) * 0.6
            );

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 4 + 2,
                (Math.random() - 0.5) * 3
            );

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity,
                life: 1.0,
                maxLife: 1.0,
            });
        }
    }

    update(delta: number): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.velocity.y += GRAVITY * delta;
            p.mesh.position.x += p.velocity.x * delta;
            p.mesh.position.y += p.velocity.y * delta;
            p.mesh.position.z += p.velocity.z * delta;
            p.life -= delta;

            const material = p.mesh.material as THREE.MeshBasicMaterial;
            material.opacity = p.life / p.maxLife;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    dispose(): void {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            (p.mesh.material as THREE.Material).dispose();
        }
        this.particles = [];
        this.geometry.dispose();
    }
}

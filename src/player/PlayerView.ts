import * as THREE from 'three';
import { Player } from './Player';
import { World } from '../engine/World';
import { BlockId, getBlockType, isSolid } from '../blocks/BlockType';

export enum CameraMode {
    FirstPerson,
    ThirdPerson,
}

const THIRD_PERSON_DISTANCE = 3.5;
const THIRD_PERSON_HEIGHT = 0.5;
const CAMERA_MIN_DISTANCE = 0.5;

export class PlayerView {
    private bodyGroup: THREE.Group;
    private leftArm!: THREE.Mesh;
    private rightArm!: THREE.Mesh;
    private leftLeg!: THREE.Mesh;
    private rightLeg!: THREE.Mesh;

    private heldItem: THREE.Group;
    private heldItemBox!: THREE.Mesh;
    private heldItemMaterial: THREE.MeshLambertMaterial;

    private camera: THREE.PerspectiveCamera;
    private scene: THREE.Scene;
    private world: World;
    private mode: CameraMode = CameraMode.FirstPerson;

    private walkCycle: number = 0;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: World) {
        this.scene = scene;
        this.camera = camera;
        this.world = world;

        this.bodyGroup = this.buildBody();
        this.scene.add(this.bodyGroup);

        this.heldItemMaterial = new THREE.MeshLambertMaterial({ color: 0x5fb84f });
        this.heldItem = this.buildHeldItem();
        this.camera.add(this.heldItem);

        this.setMode(CameraMode.FirstPerson);
    }

    private buildBody(): THREE.Group {
        const group = new THREE.Group();

        const skinColor = 0xf0c090;
        const shirtColor = 0x3a7adf;
        const pantsColor = 0x2a2a4a;

        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: skinColor }));
        head.position.y = 1.55;
        group.add(head);

        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.28);
        const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: shirtColor }));
        body.position.y = 0.95;
        group.add(body);

        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        this.leftArm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: shirtColor }));
        this.leftArm.position.set(-0.35, 0.95, 0);
        group.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo.clone(), new THREE.MeshLambertMaterial({ color: shirtColor }));
        this.rightArm.position.set(0.35, 0.95, 0);
        group.add(this.rightArm);

        const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.22);
        this.leftLeg = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: pantsColor }));
        this.leftLeg.position.set(-0.13, 0.2, 0);
        group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo.clone(), new THREE.MeshLambertMaterial({ color: pantsColor }));
        this.rightLeg.position.set(0.13, 0.2, 0);
        group.add(this.rightLeg);

        return group;
    }

    private buildHeldItem(): THREE.Group {
        const group = new THREE.Group();

        const armGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
        const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: 0xf0c090 }));
        arm.position.set(0, -0.25, 0);
        group.add(arm);

        const boxGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        this.heldItemBox = new THREE.Mesh(boxGeo, this.heldItemMaterial);
        this.heldItemBox.position.set(0, -0.55, -0.15);
        group.add(this.heldItemBox);

        group.position.set(0.55, -0.35, -0.6);
        group.rotation.set(-0.3, 0.4, 0);
        group.scale.set(0.8, 0.8, 0.8);

        return group;
    }

    toggleMode(): void {
        this.setMode(this.mode === CameraMode.FirstPerson ? CameraMode.ThirdPerson : CameraMode.FirstPerson);
    }

    setMode(mode: CameraMode): void {
        this.mode = mode;
        this.bodyGroup.visible = mode === CameraMode.ThirdPerson;
        this.heldItem.visible = mode === CameraMode.FirstPerson;
    }

    getMode(): CameraMode {
        return this.mode;
    }

    updateHeldItem(blockId: BlockId): void {
        const blockType = getBlockType(blockId);
        const color = new THREE.Color(blockType.colors.top);
        this.heldItemMaterial.color.copy(color);
    }

    update(delta: number, player: Player): void {
        const eyePos = player.getEyePosition();

        if (this.mode === CameraMode.ThirdPerson) {
            this.bodyGroup.position.copy(player.position);
            this.bodyGroup.rotation.y = player.yaw;

            const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2);
            if (speed > 0.5 && player.onGround) {
                this.walkCycle += delta * speed * 6;
                const swing = Math.sin(this.walkCycle) * 0.6;
                this.leftArm.rotation.x = swing;
                this.rightArm.rotation.x = -swing;
                this.leftLeg.rotation.x = -swing;
                this.rightLeg.rotation.x = swing;
            } else {
                this.leftArm.rotation.x *= 0.8;
                this.rightArm.rotation.x *= 0.8;
                this.leftLeg.rotation.x *= 0.8;
                this.rightLeg.rotation.x *= 0.8;
            }

            const lookDir = player.getLookDirection();
            const desiredPos = new THREE.Vector3(
                eyePos.x - lookDir.x * THIRD_PERSON_DISTANCE,
                eyePos.y + THIRD_PERSON_HEIGHT - lookDir.y * THIRD_PERSON_DISTANCE,
                eyePos.z - lookDir.z * THIRD_PERSON_DISTANCE
            );

            const direction = desiredPos.clone().sub(eyePos);
            const distance = direction.length();
            direction.normalize();

            const stepX = Math.sign(direction.x);
            const stepY = Math.sign(direction.y);
            const stepZ = Math.sign(direction.z);

            const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
            const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
            const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

            let cx = Math.floor(eyePos.x);
            let cy = Math.floor(eyePos.y);
            let cz = Math.floor(eyePos.z);

            let tMaxX = direction.x > 0 ? (cx + 1 - eyePos.x) / direction.x : direction.x < 0 ? (eyePos.x - cx) / -direction.x : Infinity;
            let tMaxY = direction.y > 0 ? (cy + 1 - eyePos.y) / direction.y : direction.y < 0 ? (eyePos.y - cy) / -direction.y : Infinity;
            let tMaxZ = direction.z > 0 ? (cz + 1 - eyePos.z) / direction.z : direction.z < 0 ? (eyePos.z - cz) / -direction.z : Infinity;

            let actualDistance = distance;

            while (actualDistance > 0) {
                if (tMaxX < tMaxY && tMaxX < tMaxZ) {
                    if (tMaxX > distance) break;
                    cx += stepX;
                    if (this.isSolid(cx, cy, cz)) {
                        actualDistance = Math.max(CAMERA_MIN_DISTANCE, tMaxX - 0.05);
                        break;
                    }
                    tMaxX += tDeltaX;
                } else if (tMaxY < tMaxZ) {
                    if (tMaxY > distance) break;
                    cy += stepY;
                    if (this.isSolid(cx, cy, cz)) {
                        actualDistance = Math.max(CAMERA_MIN_DISTANCE, tMaxY - 0.05);
                        break;
                    }
                    tMaxY += tDeltaY;
                } else {
                    if (tMaxZ > distance) break;
                    cz += stepZ;
                    if (this.isSolid(cx, cy, cz)) {
                        actualDistance = Math.max(CAMERA_MIN_DISTANCE, tMaxZ - 0.05);
                        break;
                    }
                    tMaxZ += tDeltaZ;
                }
            }

            this.camera.position.set(
                eyePos.x + direction.x * actualDistance,
                eyePos.y + direction.y * actualDistance,
                eyePos.z + direction.z * actualDistance
            );
            this.camera.lookAt(eyePos.x, eyePos.y, eyePos.z);
        } else {
            this.camera.position.copy(eyePos);
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = player.yaw;
            this.camera.rotation.x = player.pitch;
        }
    }

    private isSolid(x: number, y: number, z: number): boolean {
        const id = this.world.getBlock(x, y, z);
        if (id === 0) return false;
        return isSolid(id);
    }

    dispose(): void {
        this.camera.remove(this.heldItem);
        this.scene.remove(this.bodyGroup);
        this.bodyGroup.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        });
        this.heldItem.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        });
    }
}

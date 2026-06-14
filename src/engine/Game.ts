/**
 * Game engine - ties together all subsystems.
 * Manages scene, camera, renderer, game loop, and block interaction.
 */

import * as THREE from 'three';
import { World } from './World';
import { TerrainGenerator } from './TerrainGenerator';
import { ChunkManager } from './ChunkManager';
import { raycastVoxel } from './VoxelRaycaster';
import { disposeMaterials } from './MeshBuilder';
import { Player } from '../player/Player';
import { Controls } from '../player/Controls';
import { Physics } from '../player/Physics';
import { BlockId, HOTBAR_BLOCKS, isBreakable, getBlockType } from '../blocks/BlockType';
import { ParticleManager } from '../effects/ParticleManager';
import { DayNightCycle } from './DayNightCycle';
import { Inventory } from '../inventory/Inventory';
import { Survival } from '../player/Survival';
import { EntityManager } from '../entities/EntityManager';
import { PlayerView } from '../player/PlayerView';
import { AudioManager } from '../audio/AudioManager';

export class Game {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;

    world: World;
    terrainGenerator: TerrainGenerator;
    chunkManager: ChunkManager;

    player: Player;
    controls: Controls;
    physics: Physics;
    particles: ParticleManager;
    dayNight: DayNightCycle;
    inventory: Inventory;
    survival: Survival;
    entityManager: EntityManager;
    playerView: PlayerView;
    audio: AudioManager;

    selectedSlot: number = 0;

    private blockHighlight: THREE.LineSegments;

    // FPS tracking
    private fps: number = 0;
    private frameCount: number = 0;
    private fpsTimer: number = 0;

    // Game loop
    private running: boolean = false;
    private clock: THREE.Clock;

    // Callback for UI updates
    onStatsUpdate: ((stats: { fps: number; x: number; y: number; z: number; chunks: number }) => void) | null = null;
    onSaveStatus: ((message: string) => void) | null = null;

    private autoSaveTimer: number = 0;
    private static readonly AUTO_SAVE_INTERVAL = 30;
    private footstepTimer: number = 0;
    private wasNight: boolean = false;

    constructor() {
        // Scene with fog
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        const fogStart = (4 - 1) * 16; // RENDER_RADIUS - 1) * CHUNK_SIZE
        const fogEnd = 4 * 16 + 16;
        this.scene.fog = new THREE.Fog(0x87CEEB, fogStart, fogEnd);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        this.scene.add(directionalLight);

        this.dayNight = new DayNightCycle(this.scene, directionalLight, ambientLight);

        const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
        const edges = new THREE.EdgesGeometry(boxGeo);
        this.blockHighlight = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        this.blockHighlight.visible = false;
        this.scene.add(this.blockHighlight);

        // World
        this.terrainGenerator = new TerrainGenerator(12345);
        this.world = new World(this.terrainGenerator);
        this.chunkManager = new ChunkManager(this.world, this.scene);

        // Player - spawn at center, will be adjusted after initial load
        this.player = new Player(0.5, 50, 0.5);
        this.controls = new Controls(this.player, this.renderer.domElement);
        this.physics = new Physics(this.world);
        this.particles = new ParticleManager(this.scene);
        this.audio = new AudioManager();
        this.inventory = new Inventory();
        this.inventory.fillCreative(HOTBAR_BLOCKS);
        this.survival = new Survival();
        this.entityManager = new EntityManager(this.scene, this.world);
        this.playerView = new PlayerView(this.scene, this.camera, this.world);

        // Clock
        this.clock = new THREE.Clock();

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());

        // Handle mouse clicks for block interaction
        document.addEventListener('mousedown', () => {
            this.audio.init();
            this.audio.startDayAmbient();
        }, { once: true });

        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    }

    private static readonly SAVE_KEY = 'voxelcraft_save';

    loadGame(): boolean {
        try {
            const raw = localStorage.getItem(Game.SAVE_KEY);
            if (!raw) return false;

            const data = JSON.parse(raw);
            const mods = new Map<string, number>(data.mods as [string, number][]);
            this.world.setModifications(mods);

            if (data.player) {
                this.pendingPlayerPos = data.player;
            }

            if (this.onSaveStatus) this.onSaveStatus('Loaded');
            return true;
        } catch {
            return false;
        }
    }

    private pendingPlayerPos: { x: number; y: number; z: number } | null = null;

    saveGame(): void {
        try {
            const mods = Array.from(this.world.getModifications().entries());
            const data = {
                mods,
                player: {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z,
                },
            };
            localStorage.setItem(Game.SAVE_KEY, JSON.stringify(data));
            if (this.onSaveStatus) this.onSaveStatus(`Saved (${mods.length} blocks)`);
        } catch {
            if (this.onSaveStatus) this.onSaveStatus('Save failed');
        }
    }

    /** Initialize the game - load spawn area */
    init(): void {
        this.loadGame();

        const spawnX = this.pendingPlayerPos?.x ?? 0;
        const spawnZ = this.pendingPlayerPos?.z ?? 0;

        this.chunkManager.initialLoad(Math.floor(spawnX), Math.floor(spawnZ));

        if (this.pendingPlayerPos) {
            this.player.teleport(
                this.pendingPlayerPos.x,
                this.pendingPlayerPos.y,
                this.pendingPlayerPos.z
            );
            this.pendingPlayerPos = null;
        } else {
            this.findSafeSpawn();
        }

        const app = document.getElementById('app');
        if (app) {
            app.appendChild(this.renderer.domElement);
        }
    }

    /** Find a safe Y position to spawn at center */
    private findSafeSpawn(): void {
        const offsets = [
            [0, 0], [2, 0], [0, 2], [-2, 0], [0, -2],
            [3, 3], [-3, 3], [3, -3], [-3, -3],
        ];

        for (const [ox, oz] of offsets) {
            for (let y = 60; y >= 1; y--) {
                const blockId = this.world.getBlock(ox, y, oz);
                if (blockId === BlockId.Air) continue;
                if (blockId === BlockId.Wood || blockId === BlockId.Leaves) continue;
                const blockType = getBlockType(blockId as BlockId);
                if (!blockType.solid) continue;
                if (this.world.getBlock(ox, y + 1, oz) === BlockId.Air &&
                    this.world.getBlock(ox, y + 2, oz) === BlockId.Air) {
                    this.player.teleport(ox + 0.5, y + 1, oz + 0.5);
                    return;
                }
                break;
            }
        }
        this.player.teleport(0.5, 40, 0.5);
    }

    /** Start the game loop */
    start(): void {
        this.running = true;
        this.animate();
    }

    /** Stop the game loop */
    stop(): void {
        this.running = false;
    }

    /** Main game loop */
    private animate = (): void => {
        if (!this.running) return;

        requestAnimationFrame(this.animate);

        const delta = Math.min(this.clock.getDelta(), 0.05); // Cap delta at 50ms

        // Only update physics if pointer is locked (game active)
        if (this.controls.isLocked()) {
            const moveDir = this.controls.getMoveDirection();

            if (this.controls.isJumping()) {
                this.physics.jump(this.player);
            }

            if (this.controls.consumeToggleView()) {
                this.playerView.toggleMode();
            }

            if (this.controls.consumeSave()) {
                this.saveGame();
            }

            this.physics.update(this.player, moveDir, delta);

            const isMoving = moveDir.lengthSq() > 0.1;
            this.survival.update(delta, this.player, this.world, isMoving);

            this.footstepTimer += delta;
            if (isMoving && this.footstepTimer >= 0.35) {
                this.footstepTimer = 0;
                this.audio.playFootstep();
            }

            if (this.survival.isDead) {
                this.handleDeath();
            }
        }

        // Update chunks based on player position
        this.chunkManager.update(
            Math.floor(this.player.position.x),
            Math.floor(this.player.position.z)
        );

        this.particles.update(delta);
        this.dayNight.update(delta);

        if (this.dayNight.isNight && !this.wasNight) {
            this.audio.startNightAmbient();
            this.wasNight = true;
        } else if (!this.dayNight.isNight && this.wasNight) {
            this.audio.startDayAmbient();
            this.wasNight = false;
        }

        this.entityManager.update(delta, this.world, this.player.position, this.player.yaw, this.dayNight.isNight);

        this.autoSaveTimer += delta;
        if (this.autoSaveTimer >= Game.AUTO_SAVE_INTERVAL) {
            this.autoSaveTimer = 0;
            this.saveGame();
        }

        this.playerView.update(delta, this.player);

        this.updateBlockHighlight();

        this.renderer.render(this.scene, this.camera);

        // FPS tracking
        this.frameCount++;
        this.fpsTimer += delta;
        if (this.fpsTimer >= 0.5) {
            this.fps = Math.round(this.frameCount / this.fpsTimer);
            this.frameCount = 0;
            this.fpsTimer = 0;

            // Notify UI
            if (this.onStatsUpdate) {
                this.onStatsUpdate({
                    fps: this.fps,
                    x: Math.floor(this.player.position.x),
                    y: Math.floor(this.player.position.y),
                    z: Math.floor(this.player.position.z),
                    chunks: this.world.chunkCount,
                });
            }
        }
    };

    private updateBlockHighlight(): void {
        const eyePos = this.player.getEyePosition();
        const dir = this.player.getLookDirection();
        const result = raycastVoxel(eyePos, dir, 6, this.world);

        if (result.hit) {
            this.blockHighlight.visible = true;
            this.blockHighlight.position.set(
                result.block.x + 0.5,
                result.block.y + 0.5,
                result.block.z + 0.5
            );
        } else {
            this.blockHighlight.visible = false;
        }
    }

    private handleDeath(): void {
        this.survival.respawn();
        this.findSafeSpawn();
    }

    /** Handle mouse clicks for block break/place */
    private onMouseDown(e: MouseEvent): void {
        if (!this.controls.isLocked()) return;

        const eyePos = this.player.getEyePosition();
        const direction = this.player.getLookDirection();

        const result = raycastVoxel(eyePos, direction, 6, this.world);

        if (!result.hit) return;

        if (e.button === 0) {
            // Left click - break block
            this.breakBlock(result.block.x, result.block.y, result.block.z);
        } else if (e.button === 2) {
            // Right click - place block
            const placeX = result.block.x + result.normal.x;
            const placeY = result.block.y + result.normal.y;
            const placeZ = result.block.z + result.normal.z;
            this.placeBlock(placeX, placeY, placeZ);
        }
    }

    private breakBlock(x: number, y: number, z: number): void {
        const blockId = this.world.getBlock(x, y, z);
        if (!isBreakable(blockId)) return;

        this.particles.spawnBlockBreak(x, y, z, blockId as BlockId);
        this.world.setBlock(x, y, z, BlockId.Air);
        this.chunkManager.markDirtyAt(x, y, z);
        this.inventory.addItem(blockId, 1);
        this.audio.playBlockBreak(blockId);
    }

    private placeBlock(x: number, y: number, z: number): void {
        if (y < 1) return;
        if (this.world.getBlock(x, y, z) !== BlockId.Air) return;
        if (this.checkPlayerOverlap(x, y, z)) return;

        const stack = this.inventory.getSelectedStack();
        if (!stack || stack.count <= 0) return;

        this.world.setBlock(x, y, z, stack.itemId);
        this.chunkManager.markDirtyAt(x, y, z);

        this.audio.playBlockPlace(stack.itemId);
        stack.count--;
        if (stack.count <= 0) {
            this.inventory.hotbar[this.inventory.selectedSlot] = null;
        }
    }

    /** Check if placing a block at position would overlap the player */
    private checkPlayerOverlap(x: number, y: number, z: number): boolean {
        const playerAABB = this.player.getAABB();
        const blockAABB = new THREE.Box3(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(x + 1, y + 1, z + 1)
        );
        return playerAABB.intersectsBox(blockAABB);
    }

    /** Handle window resize */
    private onResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    selectSlot(index: number): void {
        this.inventory.selectSlot(index);
        this.selectedSlot = this.inventory.selectedSlot;
        const stack = this.inventory.getSelectedStack();
        if (stack) {
            this.playerView.updateHeldItem(stack.itemId as BlockId);
        }
    }

    /** Clean up resources */
    dispose(): void {
        this.running = false;
        this.playerView.dispose();
        this.entityManager.dispose();
        this.particles.dispose();
        this.renderer.dispose();
        disposeMaterials();
    }
}

import { Player } from './Player';
import { World } from '../engine/World';
import { BlockId } from '../blocks/BlockType';

const FALL_DAMAGE_THRESHOLD = 3;
const STARVATION_RATE = 1;
const REGEN_HUNGER_THRESHOLD = 18;
const REGEN_HUNGER_COST = 0.1;
const HUNGER_MOVE_COST = 0.02;
const HUNGER_IDLE_COST = 0.005;
const OXYGEN_MAX = 10;
const DROWN_DAMAGE = 1;
const SWIM_GRAVITY = -5;

export enum DamageSource {
    Fall = 'fall',
    Starvation = 'starvation',
    Drowning = 'drowning',
}

export class Survival {
    health: number = 20;
    maxHealth: number = 20;
    hunger: number = 20;
    maxHunger: number = 20;
    oxygen: number = OXYGEN_MAX;
    isDead: boolean = false;

    private fallPeakY: number = 0;
    private wasOnGround: boolean = true;
    private drownTimer: number = 0;
    private regenTimer: number = 0;
    private starveTimer: number = 0;

    onDeath: (() => void) | null = null;
    onDamage: ((amount: number, source: DamageSource) => void) | null = null;

    update(delta: number, player: Player, world: World, isMoving: boolean): void {
        if (this.isDead) return;

        const px = Math.floor(player.position.x);
        const py = Math.floor(player.position.y);
        const pz = Math.floor(player.position.z);
        const inWater = world.getBlock(px, py + 1, pz) === BlockId.Water;

        this.updateFallDamage(player);
        this.updateHunger(delta, isMoving);
        this.updateOxygen(delta, inWater);
        this.updateRegeneration(delta);

        if (inWater) {
            player.velocity.y = Math.max(player.velocity.y + SWIM_GRAVITY * delta, -3);
        }
    }

    private updateFallDamage(player: Player): void {
        if (!player.onGround) {
            if (this.wasOnGround) {
                this.fallPeakY = player.position.y;
            } else {
                this.fallPeakY = Math.max(this.fallPeakY, player.position.y);
            }
            this.wasOnGround = false;
        } else {
            if (!this.wasOnGround) {
                const fallDist = this.fallPeakY - player.position.y;
                if (fallDist > FALL_DAMAGE_THRESHOLD) {
                    const damage = Math.floor(fallDist - FALL_DAMAGE_THRESHOLD);
                    if (damage > 0) {
                        this.takeDamage(damage, DamageSource.Fall);
                    }
                }
            }
            this.fallPeakY = player.position.y;
            this.wasOnGround = true;
        }
    }

    private updateHunger(delta: number, isMoving: boolean): void {
        const cost = isMoving ? HUNGER_MOVE_COST : HUNGER_IDLE_COST;
        this.hunger = Math.max(0, this.hunger - cost * delta);

        if (this.hunger <= 0) {
            this.starveTimer += delta;
            if (this.starveTimer >= 1) {
                this.starveTimer = 0;
                this.takeDamage(STARVATION_RATE, DamageSource.Starvation);
            }
        } else {
            this.starveTimer = 0;
        }
    }

    private updateOxygen(delta: number, inWater: boolean): void {
        if (inWater) {
            this.oxygen = Math.max(0, this.oxygen - delta);
            if (this.oxygen <= 0) {
                this.drownTimer += delta;
                if (this.drownTimer >= 1) {
                    this.drownTimer = 0;
                    this.takeDamage(DROWN_DAMAGE, DamageSource.Drowning);
                }
            }
        } else {
            this.oxygen = OXYGEN_MAX;
            this.drownTimer = 0;
        }
    }

    private updateRegeneration(delta: number): void {
        if (this.hunger >= REGEN_HUNGER_THRESHOLD && this.health < this.maxHealth) {
            this.regenTimer += delta;
            if (this.regenTimer >= 2) {
                this.regenTimer = 0;
                this.health = Math.min(this.maxHealth, this.health + 1);
                this.hunger = Math.max(0, this.hunger - REGEN_HUNGER_COST * 10);
            }
        } else {
            this.regenTimer = 0;
        }
    }

    takeDamage(amount: number, source: DamageSource): void {
        if (this.isDead) return;
        this.health = Math.max(0, this.health - amount);
        if (this.onDamage) this.onDamage(amount, source);
        if (this.health <= 0) {
            this.isDead = true;
            if (this.onDeath) this.onDeath();
        }
    }

    heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    eat(hungerRestore: number): void {
        this.hunger = Math.min(this.maxHunger, this.hunger + hungerRestore);
    }

    respawn(): void {
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;
        this.oxygen = OXYGEN_MAX;
        this.isDead = false;
        this.fallPeakY = 0;
        this.wasOnGround = true;
        this.drownTimer = 0;
        this.regenTimer = 0;
        this.starveTimer = 0;
    }

    get healthPercent(): number {
        return this.health / this.maxHealth;
    }

    get hungerPercent(): number {
        return this.hunger / this.maxHunger;
    }

    get oxygenPercent(): number {
        return this.oxygen / OXYGEN_MAX;
    }
}

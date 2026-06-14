import * as THREE from 'three';

const DAY_DURATION = 600;
const SKY_COLORS: { time: number; color: number }[] = [
    { time: 0.0,  color: 0x0a0a2e },
    { time: 0.15, color: 0x0a0a2e },
    { time: 0.22, color: 0xFF6B35 },
    { time: 0.3,  color: 0x87CEEB },
    { time: 0.5,  color: 0x87CEEB },
    { time: 0.7,  color: 0xFF8C42 },
    { time: 0.78, color: 0x4B0082 },
    { time: 0.85, color: 0x0a0a2e },
    { time: 1.0,  color: 0x0a0a2e },
];

export class DayNightCycle {
    private sun: THREE.DirectionalLight;
    private ambient: THREE.AmbientLight;
    private scene: THREE.Scene;
    private skyColor: THREE.Color;
    private time: number = 0.3;

    constructor(scene: THREE.Scene, sun: THREE.DirectionalLight, ambient: THREE.AmbientLight) {
        this.scene = scene;
        this.sun = sun;
        this.ambient = ambient;
        this.skyColor = new THREE.Color(0x87CEEB);
    }

    update(delta: number): void {
        this.time += delta / DAY_DURATION;
        if (this.time >= 1.0) this.time -= 1.0;

        const sunAngle = this.time * Math.PI * 2 - Math.PI / 2;
        const sunHeight = Math.max(0, Math.sin(sunAngle));

        this.sun.position.set(
            Math.cos(sunAngle) * 100,
            Math.sin(sunAngle) * 100,
            50
        );
        this.sun.intensity = sunHeight * 0.8;
        this.ambient.intensity = 0.2 + sunHeight * 0.4;

        this.interpolateSkyColor(this.time);

        if (this.scene.background instanceof THREE.Color) {
            this.scene.background.copy(this.skyColor);
        }
        if (this.scene.fog instanceof THREE.Fog) {
            this.scene.fog.color.copy(this.skyColor);
        }
    }

    private interpolateSkyColor(time: number): void {
        for (let i = 0; i < SKY_COLORS.length - 1; i++) {
            const a = SKY_COLORS[i];
            const b = SKY_COLORS[i + 1];
            if (time >= a.time && time <= b.time) {
                const t = (time - a.time) / (b.time - a.time);
                const colorA = new THREE.Color(a.color);
                const colorB = new THREE.Color(b.color);
                this.skyColor.copy(colorA).lerp(colorB, t);
                return;
            }
        }
    }

    get isNight(): boolean {
        return this.time < 0.2 || this.time > 0.8;
    }

    setTime(time: number): void {
        this.time = Math.max(0, Math.min(1, time));
    }

    getTime(): number {
        return this.time;
    }
}

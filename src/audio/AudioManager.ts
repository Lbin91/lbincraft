/**
 * Procedural audio engine using Web Audio API.
 * No external sound files - all sounds synthesized via oscillators and noise buffers.
 */

export class AudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private ambientNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
    private enabled: boolean = true;

    /** Must be called after user gesture (first click) per browser policy */
    init(): void {
        if (this.ctx) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
    }

    private createNoiseBuffer(duration: number): AudioBuffer {
        const sampleRate = this.ctx!.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.ctx!.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /** Play block break sound - varies by block type */
    playBlockBreak(blockId: number): void {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;

        // Noise burst through filter
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.15);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';

        // Different frequency per block material
        // Stone/Sand=low, Wood/Leaves=mid, Snow/Ice=high
        let freq = 400;
        if (blockId <= 2) freq = 300;      // grass/dirt
        else if (blockId === 3) freq = 500; // stone
        else if (blockId === 4 || blockId === 5) freq = 600; // wood/leaves
        else if (blockId === 6) freq = 800; // sand
        else if (blockId >= 9) freq = 1000; // snow/ice

        filter.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        noise.start(now);
        noise.stop(now + 0.15);
    }

    /** Play block place sound */
    playBlockPlace(blockId: number): void {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;

        // Short tonal click
        const osc = this.ctx.createOscillator();
        osc.type = 'square';

        let freq = 200;
        if (blockId === 3) freq = 250;  // stone
        else if (blockId === 4) freq = 180; // wood
        else if (blockId === 6) freq = 300; // sand

        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.1);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    /** Play footstep sound - called periodically while moving */
    playFootstep(): void {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.05);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        noise.start(now);
        noise.stop(now + 0.05);
    }

    /** Start ambient day sound (birds-like high freq pad) */
    startDayAmbient(): void {
        this.stopAmbient();
        if (!this.ctx || !this.enabled) return;

        // High frequency soft pad
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1200;

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5; // slow modulation

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 100;

        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 2);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start();
        lfo.start();

        this.ambientNodes = [{ osc, gain }, { osc: lfo, gain: lfoGain }];
    }

    /** Start ambient night sound (low drone + cricket pattern) */
    startNightAmbient(): void {
        this.stopAmbient();
        if (!this.ctx || !this.enabled) return;

        // Low drone
        const drone = this.ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 80;

        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0;
        droneGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);

        drone.connect(droneGain);
        droneGain.connect(this.masterGain!);
        drone.start();

        // Cricket: periodic high-pitch chirp
        const cricket = this.ctx.createOscillator();
        cricket.type = 'square';
        cricket.frequency.value = 4000;

        const cricketLfo = this.ctx.createOscillator();
        cricketLfo.type = 'sine';
        cricketLfo.frequency.value = 3; // chirp rate

        const cricketLfoGain = this.ctx.createGain();
        cricketLfoGain.gain.value = 0.01;

        const cricketGain = this.ctx.createGain();
        cricketGain.gain.value = 0;

        cricketLfo.connect(cricketLfoGain);
        cricketLfoGain.connect(cricketGain.gain);
        cricket.connect(cricketGain);
        cricketGain.connect(this.masterGain!);
        cricket.start();
        cricketLfo.start();

        this.ambientNodes = [
            { osc: drone, gain: droneGain },
            { osc: cricket, gain: cricketGain },
            { osc: cricketLfo, gain: cricketLfoGain },
        ];
    }

    private stopAmbient(): void {
        for (const node of this.ambientNodes) {
            try {
                node.osc.stop();
            } catch { /* already stopped */ }
        }
        this.ambientNodes = [];
    }

    toggleMute(): boolean {
        this.enabled = !this.enabled;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.value = this.enabled ? 0.3 : 0;
        }
        if (!this.enabled) this.stopAmbient();
        return this.enabled;
    }

    get isEnabled(): boolean {
        return this.enabled;
    }
}

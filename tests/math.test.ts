import { describe, it, expect } from 'vitest';
import {
    blockIndex,
    worldToChunk,
    worldToLocal,
    chunkKey,
    clamp,
    lerp,
    CHUNK_SIZE,
    CHUNK_HEIGHT,
} from '../src/utils/math';

describe('blockIndex', () => {
    it('(0,0,0) → 0', () => {
        expect(blockIndex(0, 0, 0)).toBe(0);
    });

    it('x-only offset', () => {
        expect(blockIndex(5, 0, 0)).toBe(5);
    });

    it('z-only offset = z * CHUNK_SIZE', () => {
        expect(blockIndex(0, 0, 3)).toBe(3 * CHUNK_SIZE);
    });

    it('y-only offset = y * CHUNK_SIZE²', () => {
        expect(blockIndex(0, 2, 0)).toBe(2 * CHUNK_SIZE * CHUNK_SIZE);
    });

    it('full coord round-trips within bounds', () => {
        const x = 12, y = 40, z = 8;
        const idx = blockIndex(x, y, z);
        // idx < CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
        expect(idx).toBeLessThan(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
        // reverse: y = floor(idx / 256), rem = idx % 256, z = floor(rem / 16), x = rem % 16
        const y2 = Math.floor(idx / (CHUNK_SIZE * CHUNK_SIZE));
        const rem = idx % (CHUNK_SIZE * CHUNK_SIZE);
        const z2 = Math.floor(rem / CHUNK_SIZE);
        const x2 = rem % CHUNK_SIZE;
        expect(x2).toBe(x);
        expect(y2).toBe(y);
        expect(z2).toBe(z);
    });
});

describe('worldToChunk', () => {
    it('0 → chunk 0', () => {
        expect(worldToChunk(0)).toBe(0);
    });
    it('15 → chunk 0', () => {
        expect(worldToChunk(15)).toBe(0);
    });
    it('16 → chunk 1', () => {
        expect(worldToChunk(16)).toBe(1);
    });
    it('-1 → chunk -1 (negative coord)', () => {
        expect(worldToChunk(-1)).toBe(-1);
    });
    it('-16 → chunk -1', () => {
        expect(worldToChunk(-16)).toBe(-1);
    });
    it('-17 → chunk -2', () => {
        expect(worldToChunk(-17)).toBe(-2);
    });
});

describe('worldToLocal', () => {
    it('0 → 0', () => {
        expect(worldToLocal(0)).toBe(0);
    });
    it('15 → 15', () => {
        expect(worldToLocal(15)).toBe(15);
    });
    it('16 → 0 (wraps to next chunk)', () => {
        expect(worldToLocal(16)).toBe(0);
    });
    it('-1 → 15 (negative wraps correctly)', () => {
        expect(worldToLocal(-1)).toBe(15);
    });
    it('-16 → 0', () => {
        expect(worldToLocal(-16)).toBe(0);
    });
});

describe('chunkKey', () => {
    it('produces correct key', () => {
        expect(chunkKey(3, -5)).toBe('3,-5');
    });
    it('(0,0) → "0,0"', () => {
        expect(chunkKey(0, 0)).toBe('0,0');
    });
});

describe('clamp', () => {
    it('clamps below min', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
    });
    it('clamps above max', () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });
    it('passes through within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });
});

describe('lerp', () => {
    it('t=0 → a', () => {
        expect(lerp(10, 20, 0)).toBe(10);
    });
    it('t=1 → b', () => {
        expect(lerp(10, 20, 1)).toBe(20);
    });
    it('t=0.5 → midpoint', () => {
        expect(lerp(10, 20, 0.5)).toBe(15);
    });
});

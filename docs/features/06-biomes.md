# Feature 06: Biomes

> 난이도: ⭐⭐ Medium | 예상 시간: 2.5시간

## 개요

월드를 여러 생물군계(biome)로 나누어 지형, 블록, 색상이 지역마다 달라지도록 함. 사막, 초원, 숲, 설원, 산악 등 다양한 환경 제공.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 한 방향으로 이동하면 | 지형이 점차 변함 (초원 → 사막 → 설원 등) |
| S2 | 사막 바이옴에서는 | 표면이 모래, 나무 없음, 평탄한 지형 |
| S3 | 산악 바이옴에서는 | 높은 산, 표면이 돌/흙, 눈 높이 |
| S4 | 숲 바이옴에서는 | 나무가 빽빽하게 생성 |
| S5 | 설원 바이옴에서는 | 표면이 흰색 블록(눈), 물이 얼음 |
| S6 | 바이옴 경계에서는 | 자연스럽게 전환됨 |

## 기술 설계

### 신규 파일
- `src/engine/BiomeType.ts` — 바이옴 정의 및 타입

### 수정 파일
- `src/engine/TerrainGenerator.ts` — 바이옴 노이즈로 지형 파라미터 결정

### 데이터 구조

```typescript
// BiomeType.ts
export enum BiomeId {
    Plains = 0,      // 초원 (기본)
    Desert = 1,      // 사막
    Forest = 2,      // 숲
    Mountains = 3,   // 산악
    Snow = 4,        // 설원
}

export interface BiomeType {
    id: BiomeId;
    name: string;
    surfaceBlock: BlockId;     // 표면 블록
    subsurfaceBlock: BlockId;  // 표면 아래 블록
    baseHeight: number;        // 기준 높이
    amplitude: number;         // 지형 높낮이 변화
    treeDensity: number;       // 나무 생성 확률 (0~1)
    waterColor?: number;       // 물 색상 (설원은 짙음)
}

export const BIOMES: Record<BiomeId, BiomeType> = {
    [BiomeId.Plains]:     { surfaceBlock: Grass, subsurfaceBlock: Dirt,  baseHeight: 28, amplitude: 8,  treeDensity: 0.02 },
    [BiomeId.Desert]:     { surfaceBlock: Sand,  subsurfaceBlock: Sand,  baseHeight: 26, amplitude: 4,  treeDensity: 0.0 },
    [BiomeId.Forest]:     { surfaceBlock: Grass, subsurfaceBlock: Dirt,  baseHeight: 30, amplitude: 10, treeDensity: 0.08 },
    [BiomeId.Mountains]:  { surfaceBlock: Stone, subsurfaceBlock: Stone, baseHeight: 40, amplitude: 25, treeDensity: 0.01 },
    [BiomeId.Snow]:       { surfaceBlock: Grass, subsurfaceBlock: Dirt,  baseHeight: 32, amplitude: 12, treeDensity: 0.03 },
};
```

### 로직

```
// TerrainGenerator에 바이옴 노이즈 추가
private biomeNoise: (x: number, y: number) => number;

getBiome(wx, wz): BiomeType {
    // 2개 노이즈를 매핑하여 바이옴 결정
    const temp = this.biomeNoise(wx * 0.003, wz * 0.003);   // 온도 (-1~1)
    const humid = this.biomeNoise(wx * 0.004 + 100, wz * 0.004 + 100); // 습도

    if (temp < -0.3) return BIOMES[BiomeId.Snow];
    if (temp > 0.4 && humid < 0) return BIOMES[BiomeId.Desert];
    if (humid > 0.3) return BIOMES[BiomeId.Forest];
    if (temp > 0.2) return BIOMES[BiomeId.Mountains];
    return BIOMES[BiomeId.Plains];
}

generateChunk(chunk):
    for each (x, z):
        biome = getBiome(worldX, worldZ)
        height = fBm(worldX, worldZ, biome.amplitude, biome.baseHeight)
        // 블록 배치 시 biome.surfaceBlock / subsurfaceBlock 사용
        // 나무 생성 시 biome.treeDensity 사용
```

### 바이옴 블렌딩 (★ Oracle 검토 반영 - Bilinear Interpolation)

경계에서 절벽이 생기지 않도록 연속 파라미터를 보간:

```
getBlendedBiomeParams(wx, wz):
  // 주변 4개 샘플링 포인트의 바이옴 파라미터를 가중 평균
  const samples = [
    { x: floor(wx/8)*8, z: floor(wz/8)*8 },
    { x: ceil(wx/8)*8,  z: floor(wz/8)*8 },
    { x: floor(wx/8)*8, z: ceil(wz/8)*8 },
    { x: ceil(wx/8)*8,  z: ceil(wz/8)*8 },
  ]
  // 각 샘플 포인트의 baseHeight, amplitude를 bilinear 가중 평균
  → 부드러운 지형 높이 전환
```

### 추가 블록 (★ Oracle 검토 반영)

```typescript
// BlockType.ts에 추가
export enum BlockId {
    // 기존...
    Snow = 9,     // 설원 표면 (흰색)
    Ice = 10,     // 얼어붙은 물 (반투명 파랑)
}
```

## 의존성
- 없음

## 성공 기준

- [ ] 이동하면 지형이 바이옴별로 변한다
- [ ] 사막은 모래 + 평탄 + 나무 없음
- [ ] 산악은 높은 지형 + 돌 표면
- [ ] 숲은 나무가 빽빽함
- [ ] 설원은 눈 색상 표면
- [ ] 바이옴 경계가 자연스럽다
- [ ] 성능 저하가 미미하다

## 검증 방법

1. 한 방향으로 200블록 이동하며 지형 변화 관찰
2. 디버그로 현재 바이옴 표시 추가
3. 각 바이옴에서 블록 종류 확인

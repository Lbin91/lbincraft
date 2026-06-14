# Feature 05: Caves

> 난이도: ⭐⭐ Medium | 예상 시간: 2시간

## 개요

3D 노이즈를 사용하여 지하에 동굴과 터널을 생성. 지형에 수직/수평 갱도가 생겨 채굴과 탐험이 의미있어짐.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 지표면 아래를 파내려가면 | 동굴 공간이 나타남 (빈 공간) |
| S2 | 동굴은 | 서로 연결된 터널 형태 (완전히 랜덤한 구멍이 아님) |
| S3 | 동굴 내부는 | 어두움 (조명 없음) |
| S4 | 지표면 근처(y > 25)에는 | 동굴이 거의 없음 (지형 무너짐 방지) |
| S5 | 다양한 깊이에서 | 동굴 밀도가 다름 (깊을수록 많음) |

## 기술 설계

### 수정 파일
- `src/engine/TerrainGenerator.ts` — 3D 노이즈 기반 동굴 카빙 추가

### 데이터 구조

```typescript
// TerrainGenerator에 추가
private caveNoise3D: (x: number, y: number, z: number) => number;

// 생성자에서
this.caveNoise3D = createNoise3D(prng);

// 동굴 파라미터
const CAVE_THRESHOLD = 0.6;      // 노이즈 값이 이 이상이면 공기
const CAVE_MAX_HEIGHT = 28;      // 이 높이까지만 동굴 생성
const CAVE_NOISE_FREQ = 0.05;    // 동굴 노이즈 주파수
```

### 로직

```
generateChunk(chunk):
  // 기존 지형 생성 로직...
  for each (x, y, z):
    if y === 0: bedrock; continue
    if y < CAVE_MAX_HEIGHT:
      caveValue = caveNoise3D(x * FREQ, y * FREQ, z * FREQ)
      // 깊이에 따른 임계값 조정 (깊을수록 동굴 많음)
      depthFactor = (CAVE_MAX_HEIGHT - y) / CAVE_MAX_HEIGHT  // 0~1
      threshold = CAVE_THRESHOLD - depthFactor * 0.15  // 깊으면 임계값 낮아짐
      if caveValue > threshold && blockId !== Bedrock:
        blockId = Air  // 동굴로 카빙
```

### 3D 노이즈 패턴

- `simplex-noise`의 `createNoise3D` 사용
- 주파수 0.05 → 약 20블록 간격의 동굴 구조
- 2개 노이즈를 교차하여 더 자연스러운 터널 형태 가능 (Phase 2)

### 동굴 입구 처리

- 지표면 근처(y > CAVE_MAX_HEIGHT - 5)에서는 노이즈 임계값을 높여 동굴이 지표면까지 뚫리지 않게 함
- 단, 드물게(10% 확률) 지표면까지 뚫리는 동굴 입구 허용

## 의존성
- 없음

## 성공 기준

- [ ] 지하에 동굴 공간이 생성된다
- [ ] 동굴이 터널처럼 연결되어 있다
- [ ] 지표면 근처에는 동굴이 거의 없다
- [ ] 깊을수록 동굴이 많다
- [ ] 기반암(y=0)은 동굴로 변하지 않는다
- [ ] 지형 생성 성능이 크게 저하되지 않는다 (< 2x)

## 검증 방법

1. 게임 실행 후 지표면 아래로 파내려가며 동굴 발견 확인
2. `game.world.getBlock(0, 10, 0)` 등으로 지하 블록 확인 (디버그)
3. 단일 청크 생성 시간 측정 (3D 노이즈 추가 후)

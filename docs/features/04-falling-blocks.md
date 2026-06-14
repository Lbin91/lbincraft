# Feature 04: Falling Blocks (Sand/Gravel Physics)

> 난이도: ⭐⭐ Medium | 예상 시간: 1.5시간

## 개요

모래(Sand)와 자갈(추가 예정) 같은 블록이 아래가 비어 있으면 중력에 의해 떨어지는 기능. 마인크래프트의 핵심 물리 상호작용 중 하나.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 모래 블록 아래가 공기면 | 1블록 아래로 떨어짐, 연속 체크로 바닥까지 낙하 |
| S2 | 모래 위에 다른 블록을 설치 | 아래 모래가 즉시 떨어지기 시작 |
| S3 | 모래를 부수면 | 위에 있던 모래가 떨어짐 |
| S4 | 모래가 떨어질 자리에 블록이 생기면 | 그 위에 쌓임 |
| S5 | 일반 블록(흙, 돌)은 | 떨어지지 않음 |

## 기술 설계

### 신규 파일
- 없음

### 수정 파일
- `src/blocks/BlockType.ts` — `affectedByGravity: boolean` 속성 추가
- `src/engine/World.ts` — `setBlock` 호출 시 낙하 체크 로직 추가
- `src/engine/ChunkManager.ts` — 낙하 큐 처리

### 데이터 구조

```typescript
// BlockType.ts
interface BlockType {
    // 기존 속성...
    affectedByGravity: boolean;  // Sand만 true, 나머지 false
}

// World.ts
private fallCheckQueue: { x: number; y: number; z: number }[] = [];

// 블록 변경 시 위쪽 블록 체크
setBlock(x, y, z, id): void {
    // 기존 로직...
    // 변경된 위치 위의 블록이 낙하 대상인지 확인
    const above = this.getBlock(x, y + 1, z);
    if (getBlockType(above)?.affectedByGravity) {
        this.fallCheckQueue.push({ x, y: y + 1, z });
    }
}
```

### 로직

```
블록 변경(setBlock) 후:
  1. 변경 위치 (x, y, z) 위의 블록(y+1)이 낙하 대상인지 확인
  2. 맞으면 fallCheckQueue에 추가

ChunkManager.update() 내에서 낙하 처리 (매 프레임):
  while (fallCheckQueue.length > 0 && processed < MAX_FALLS_PER_FRAME):
    { x, y, z } = fallCheckQueue.shift()
    blockId = world.getBlock(x, y, z)
    if !getBlockType(blockId)?.affectedByGravity: continue
    if world.getBlock(x, y - 1, z) === Air:
      world.setBlock(x, y, z, Air)
      world.setBlock(x, y - 1, z, blockId)
      fallCheckQueue.push({ x, y: y - 1, z })  // 연속 낙하
      // 위에 더 있을 수 있으니 다시 체크
      if getBlockType(world.getBlock(x, y + 1, z))?.affectedByGravity:
        fallCheckQueue.push({ x, y: y + 1, z })
```

### 성능 고려사항

- 프레임당 최대 10개 블록 낙하 처리 (대규모 붕괴 시 프레임 드랍 방지)
- fallCheckQueue 중복 제거 (Set 또는 체크)
- 일반 블록은 낙하 체크 스킵 (affectedByGravity=false)

## 의존성
- 없음

## 성공 기준

- [ ] 모래가 아래가 비면 떨어진다
- [ ] 연속 낙하로 바닥까지 도달한다
- [ ] 위 블록이 사라지면 아래 블록이 떨어지기 시작한다
- [ ] 일반 블록은 떨어지지 않는다
- [ ] 대규모 낙하 시 프레임 드랍이 없다
- [ ] 청크 경계에서도 정상 동작한다

## 검증 방법

1. 모래를 공중에 설치 → 즉시 낙하 확인
2. 모래 기둥(5개)의 맨 아래를 부숨 → 순차적 낙하 확인
3. 50개 모래 동시 낙하 → FPS 확인

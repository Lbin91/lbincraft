# 보물 지도 (Treasure Map) 기능 설계

## 개요
사용 시 세계에 숨겨진 보물의 위치를 보여주는 보물 지도 아이템을 구현합니다. 지도는 Canvas에 렌더링되며, 세계 생성 시 랜덤 위치에 보물을 묻습니다. 보물은 던전이나 희귀 위치에 한정됩니다. BlockId.TreasureMap=268으로 할당됩니다.

## 구현 범위
- 보물 지도 아이템 (TreasureMap=268)
- 지도 렌더링 (Canvas, X 마커)
- 보물 생성 시스템 (세계 생성 시 랜덤 위치)
- 던전/희귀 위치 탐지 로직
- 지도 사용 시 보물 위치 표시

## 수정 대상 파일
- `BlockId.ts`: TreasureMap=268 추가
- `World.ts`: treasureLocations Set<"x,z"> 추가, generateTreasures() 메서드
- `Game.ts`: 지도 아이템 사용 로직 추가
- `UIManager.ts`: 지도 Canvas UI 렌더링 (필요 시 신규 파일)

## 추가 파일
- `TreasureMap.ts`: 지도 렌더링 클래스
  ```typescript
  class TreasureMap {
    private canvas: HTMLCanvasElement;
    private treasureLocation: { x: number, z: number };

    render(treasureLocation: { x, z }, playerPosition: { x, z }): void {
      const ctx = this.canvas.getContext('2d');
      // 맵 렌더링 및 X 마커
    }
  }
  ```

## 데이터 구조
- `World.treasureLocations`: Set<"x,z"> - 보물 위치 집합
- `World.treasureInventories`: Map<"x,z", ItemStack[]> - 보물 아이템 (Chest에서 사용)
```typescript
// 의사 코드
class World {
  treasureLocations: Set<string> = new Set();

  generateTreasures(random: Random): void {
    const treasureCount = 5 + random.nextInt(10); // 5-15개

    for (let i = 0; i < treasureCount; i++) {
      // 던전/희귀 위치 찾기
      const position = this.findRareLocation(random);
      if (position) {
        const key = `${position.x},${position.z}`;
        this.treasureLocations.add(key);

        // 보물 인벤토리 생성 (Chest에서 사용)
        const chestInventory = generateTreasureInventory(random);
        this.chestInventories.set(`${position.x},${position.y},${position.z}`, chestInventory);

        // Modification으로 기록
        this.modificationMap.set(`${position.x},${position.y},${position.z}`, {
          blockId: BlockId.Chest,
          isTreasure: true,
          chestInventory: chestInventory,
        });
      }
    }
  }

  findRareLocation(random: Random): { x, y, z } | null {
    // 던전/동굴/높은 곳 등 희귀 위치 탐색
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = random.nextInt(1000) - 500;
      const z = random.nextInt(1000) - 500;
      const y = this.getSurfaceHeight(x, z);

      // 동굴 확인
      if (this.isCave(x, y + 1, z)) {
        return { x, y: y + 1, z };
      }

      // 높은 곳 확인
      if (y > 60 && this.getBlock(x, y - 1, z) !== BlockId.Air) {
        return { x, y, z };
      }
    }

    return null;
  }
}
```

## 핵심 로직
1. 세계 생성 시 보물 생성:
```typescript
function onWorldGenerated(world, random): void {
  world.generateTreasures(random);
}
```

2. 지도 아이템 사용 시:
```typescript
function useTreasureMap(player, world, uiManager): void {
  const nearestTreasure = findNearestTreasure(player.position, world.treasureLocations);

  if (nearestTreasure) {
    const map = new TreasureMap();
    map.render(nearestTreasure, player.position);
    uiManager.showMapUI(map.canvas);
  } else {
    uiManager.showMessage("보물을 찾을 수 없습니다.");
  }
}

function findNearestTreasure(playerPos, treasureLocations: Set<string>): { x, z } | null {
  let nearest = null;
  let minDist = Infinity;

  for (const key of treasureLocations) {
    const [x, z] = key.split(',').map(Number);
    const dist = distance(playerPos.x, playerPos.z, x, z);

    if (dist < minDist) {
      minDist = dist;
      nearest = { x, z };
    }
  }

  return minDist <= 100 ? nearest : null; // 100블록 이내만 표시
}
```

3. 지도 렌더링:
```typescript
function renderMap(canvas, treasurePos: { x, z }, playerPos: { x, z }): void {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // 맵 배경
  ctx.fillStyle = '#D4C4A8';
  ctx.fillRect(0, 0, width, height);

  // 플레이어 위치 (중앙)
  const playerX = width / 2;
  const playerY = height / 2;
  ctx.fillStyle = '#0000FF';
  ctx.beginPath();
  ctx.arc(playerX, playerY, 5, 0, Math.PI * 2);
  ctx.fill();

  // 보물 위치 (상대 좌표)
  const relX = treasurePos.x - playerPos.x;
  const relZ = treasurePos.z - playerPos.z;
  const treasureX = playerX + relX * 2; // 2배 확대
  const treasureY = playerY + relZ * 2;

  // X 마커
  ctx.fillStyle = '#FF0000';
  ctx.font = '24px Arial';
  ctx.fillText('X', treasureX - 6, treasureY + 8);

  // 방향 표시
  ctx.fillStyle = '#000000';
  ctx.fillText('N', width / 2 - 5, 20);
}
```

4. 보물 발굴 (Cest 파괴 시):
```typescript
function breakTreasureChest(world, x, y, z): void {
  const key = `${x},${z}`;
  const isTreasure = world.treasureLocations.has(key);

  if (isTreasure) {
    // 보물 발굴 효과
    spawnParticles(x, y, z, 'GOLD');

    // 보물 위치 삭제
    world.treasureLocations.delete(key);
  }

  // 일반 상자 파괴 로직 실행
  breakChest(world, x, y, z);
}
```

## 충돌/의존성
- World.treasureLocations와 chestInventories의 동기화 필요
- 지도 UI와의 연동 (Canvas 렌더링)
- 의존성: #18 Chest (보물 상자에서 사용)

## 테스트 방법
1. 보물 생성 테스트: 세계 생성 시 보물 위치 확인
2. 지도 렌더링 테스트: 지도 사용 시 보물 위치 올바르게 표시되는지 확인
3. 희귀 위치 탐지 테스트: 보물이 동굴/높은 곳에 생성되는지 확인
4. 보물 발굴 테스트: 보물 상자 파괴 시 아이템 드롭 확인
5. 지도 업데이트 테스트: 플레이어 이동 시 지도 업데이트 확인
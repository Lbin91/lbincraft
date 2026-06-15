# 낚시 (Fishing) 기능 설계

## 개요
물 블록 향해 낚싯대를 사용하면 낚시를 시작할 수 있습니다. 3-8초 랜덤 대기 후 물고기 또는 보물을 획득합니다. FishingBobber 엔티티가 물 표면에 뜨며, 낚시 성공 시 효과음이 재생됩니다. 낚싯대 아이템 BlockId.FishingRod=271, 물고기 BlockId.Fish=272로 할당됩니다.

## 구현 범위
- 낚싯대 아이템 (FishingRod=271)
- 물고기 아이템 (Fish=272)
- FishingBobber 엔티티 (물 표면 부유)
- 낚시 로직 (대기 시간, 결과 결정)
- 낚시 효과음 (물방울 + 펄럭임)
- 낚싯대 내구성 시스템

## 수정 대상 파일
- `BlockId.ts`: FishingRod=271, Fish=272 추가
- `Entity.ts`: FishingBobber 클래스
- `EntityManager.ts`: 낚시 로직 관리
- `Game.ts`: 낚싯대 사용 로직 추가
- `AudioManager.ts`: 낚시 효과음 추가
- `Inventory.ts`: 낚싯대 내구성 관리

## 추가 파일
- `FishingBobber.ts`: 낚시 부표 Entity
  ```typescript
  class FishingBobber extends Entity {
    private fishingRod: ItemStack;
    private waitTime: number;
    private startTime: number;
    private player: Player;

    constructor(x, y, z, player: Player, fishingRod: ItemStack) {
      super(x, y, z);
      this.player = player;
      this.fishingRod = fishingRod;
      this.waitTime = 3 + Math.random() * 5; // 3-8초
      this.startTime = performance.now() / 1000;
    }

    update(deltaTime: number, world): void {
      const elapsed = performance.now() / 1000 - this.startTime;

      if (elapsed >= this.waitTime) {
        this.catchFish(world);
      }

      // 물 표면에 뜨도록
      const waterLevel = world.getWaterLevel(this.position.x, this.position.z);
      if (this.position.y < waterLevel) {
        this.position.y = waterLevel;
      }
    }

    catchFish(world): void {
      const result = this.generateCatch();
      player.inventory.addItem(result);

      // 내구성 감소
      this.fishingRod.durability = (this.fishingRod.durability || 100) - 1;

      world.audioManager.playSound('fishing_catch');
      world.entityManager.despawnEntity(this.id);
    }

    generateCatch(): ItemStack {
      // 80% 물고기, 15% 보물, 5% 가치 있는 아이템
      const roll = Math.random();

      if (roll < 0.8) {
        return { itemId: BlockId.Fish, count: 1 };
      } else if (roll < 0.95) {
        // 보물 랜덤
        const treasures = [
          { itemId: ItemId.GoldNugget, count: 2 },
          { itemId: ItemId.String, count: 3 },
        ];
        return treasures[Math.floor(Math.random() * treasures.length)];
      } else {
        // 희귀 아이템
        const rare = [
          { itemId: ItemId.Saddle, count: 1 },
          { itemId: ItemId.NameTag, count: 1 },
        ];
        return rare[Math.floor(Math.random() * rare.length)];
      }
    }
  }
  ```

## 데이터 구조
- `FishingBobber.waitTime`: number - 낚시 대기 시간 (3-8초)
- `FishingBobber.startTime`: number - 낚시 시작 시간
- 낚싯대 내구성: ItemStack.durability
```typescript
// 의사 코드
class FishingBobber extends Entity {
  fishingRod: ItemStack;
  waitTime: number;
  startTime: number;
  player: Player;
  bobbing: number = 0; // 부표 떠오르는 애니메이션

  constructor(x, y, z, player: Player, fishingRod: ItemStack) {
    super(x, y, z);
    this.player = player;
    this.fishingRod = fishingRod;
    this.waitTime = 3 + Math.random() * 5;
    this.startTime = performance.now() / 1000;
    this.position.y = world.getWaterLevel(x, z);
  }

  update(deltaTime: number, world): void {
    // 부표 떠오르기 애니메이션
    this.bobbing = Math.sin(performance.now() / 1000 * 2) * 0.1;
    this.position.y = world.getWaterLevel(this.position.x, this.position.z) + this.bobbing;

    const elapsed = performance.now() / 1000 - this.startTime;

    if (elapsed >= this.waitTime) {
      this.catchFish(world);
    }
  }

  catchFish(world): void {
    const result = this.generateCatch();
    this.player.inventory.addItem(result);

    // 내구성 감소
    this.fishingRod.durability = (this.fishingRod.durability || 100) - 1;

    if (this.fishingRod.durability <= 0) {
      this.player.inventory.setItemAtSlot(
        this.player.heldSlot,
        null
      );
      world.audioManager.playSound('item_break');
    }

    world.audioManager.playSound('fishing_catch');
    world.spawnParticles(this.position, 'WATER_SPLASH');
    world.entityManager.despawnEntity(this.id);
  }

  generateCatch(): ItemStack {
    const roll = Math.random();

    if (roll < 0.8) {
      return { itemId: BlockId.Fish, count: 1 };
    } else if (roll < 0.95) {
      const treasures = [
        { itemId: ItemId.GoldNugget, count: 2 },
        { itemId: ItemId.String, count: 3 },
      ];
      return treasures[Math.floor(Math.random() * treasures.length)];
    } else {
      const rare = [
        { itemId: ItemId.Saddle, count: 1 },
        { itemId: ItemId.NameTag, count: 1 },
      ];
      return rare[Math.floor(Math.random() * rare.length)];
    }
  }
}
```

## 핵심 로직
1. 낚싯대 사용:
```typescript
function onFishingRodUse(player, world, entityManager): void {
  const heldItem = player.inventory.getSlot(player.heldSlot);

  if (heldItem && heldItem.itemId === BlockId.FishingRod) {
    // 레이캐스트로 물 블록 확인
    const raycaster = new Raycaster(player.position, player.direction);
    const intersections = raycaster.intersectObjects(world.waterMeshes);

    if (intersections.length > 0) {
      const hit = intersections[0];

      // 낚시 부표 스폰
      const bobber = new FishingBobber(
        hit.point.x,
        hit.point.y,
        hit.point.z,
        player,
        heldItem
      );

      entityManager.addEntity(bobber);
      world.audioManager.playSound('fishing_cast');
    } else {
      world.uiManager.showMessage("물 블록을 향해 낚싯대를 사용하세요.");
    }
  }
}
```

2. 물 레벨 확인:
```typescript
function getWaterLevel(world, x, z): number {
  // y=50부터 아래로 스캔하여 물 블록 찾기
  for (let y = 50; y >= 0; y--) {
    if (world.getBlock(x, y, z) === BlockId.Water) {
      return y + 1; // 물 표면
    }
  }

  return 0; // 물 없음
}
```

3. 낚시 부표 렌더링:
```typescript
function buildFishingBobberMesh(): Mesh {
  const group = new Group();

  // 빨간색 부표
  const bobber = new SphereGeometry(0.1, 16, 16);
  const bobberMesh = new Mesh(bobber, new MeshLambertMaterial({ color: 0xFF0000 }));
  group.add(bobberMesh);

  // 흰색 막대
  const stick = new CylinderGeometry(0.02, 0.02, 0.3);
  const stickMesh = new Mesh(stick, new MeshLambertMaterial({ color: 0xFFFFFF }));
  stickMesh.rotation.x = Math.PI / 2;
  stickMesh.position.z = 0.15;
  group.add(stickMesh);

  return group;
}
```

4. 효과음 재생:
```typescript
class AudioManager {
  playFishingCast(): void {
    this.playSound('water_splash', 0.5, 1.0);
  }

  playFishingCatch(): void {
    this.playSound('water_splash', 0.3, 1.5); // 물방울
    setTimeout(() => {
      this.playSound('fishing_reel', 0.7, 1.0); // 펄럭임
    }, 200);
  }
}
```

5. 낚싯대 레시피:
```typescript
const FISHING_ROD_RECIPE = {
  pattern: [
    [' ', 'S', ' '],
    [' ', 'S', ' '],
    ['S', ' ', ' '],
  ],
  key: {
    'S': ItemId.Stick,
    'T': ItemId.String,
  },
  result: { itemId: 271, count: 1, durability: 100 },
};
```

## 충돌/의존성
- EntityManager와 Entity 시스템 의존
- 물 블록 탐지 로직 의존
- 인벤토리 시스템 의존
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 낚싯대 레시피 테스트: Stick + String으로 낚싯대 제작 확인
2. 낚시 시작 테스트: 물 블록 향해 낚싯대 사용 시 부표 스폰 확인
3. 대기 시간 테스트: 3-8초 랜덤 대기 후 결과 확인
4. 결과 테스트: 물고기, 보물, 희귀 아이템 확률 확인
5. 내구성 테스트: 낚싯대 내구성 감소 확인
6. 효과음 테스트: 낚시 효과음 올바르게 재생되는지 확인
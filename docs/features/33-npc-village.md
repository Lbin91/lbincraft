# NPC 마을 (NPC Village)

## 개요
LbinCraft 월드에 자동 생성되는 NPC 마을 시스템을 구현합니다. StructureGenerator를 확장하여 집, 대장간, 도서관, 우물 등의 건물 패턴을 라이브러리화하고, 중심 우물 기준 방사형 배치로 마을을 생성합니다. NPC 주민 엔티티는 Wander AI로 마을 내를 배회하며 거래 UI를 통해 에메랄드로 아이템을 거래할 수 있습니다.

## 구현 범위
- VillageGenerator 클래스: 마을 구조물 자동 생성
- 건물 패턴 라이브러리: 집(3종), 대장간, 도서관, 우물
- NPC Villager 엔티티: Wander AI, 거래 UI
- TradeSystem: 에메랄드 ↔ 아이템 거래
- 마을 중심 우물 기준 방사형 배치 알고리즘
- 의존성 블록: Door, Chest, Stairs (건물 구성 요소)
- 마을 데이터: World 메타데이터에 저장

## 수정 대상 파일
- `TerrainGenerator.ts` - VillageGenerator 통합, 마을 생성 트리거
- `Entity.ts` - Villager 상속, isNPC 플래그 추가
- `EntityManager.ts` - Villager 등록 및 관리
- `Game.ts` - 거래 UI 호출, Villager 클릭 이벤트
- `Inventory.ts` - 에메랄드 아이템(16) 추가, 거래 인벤토리

## 추가 파일
- `VillageGenerator.ts` - 마을 구조물 생성
- `VillagerEntity.ts` - NPC 주민 엔티티
- `BuildingPattern.ts` - 건물 패턴 라이브러리
- `TradeSystem.ts` - 거래 로직
- `VillageGenerator.test.ts` - 단위 테스트

## 데이터 구조

### VillageGenerator
```typescript
class VillageGenerator {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  // 마을 생성
  generate(centerX: number, centerZ: number, seed: number): Village {
    const village: Village = {
      center: {x: centerX, z: centerZ},
      buildings: [],
      villagers: [],
      radius: 50
    };

    const rng = new SeededRandom(seed);

    // 1. 중심 우물 생성
    this.generateWell(centerX, centerZ, village);

    // 2. 건물 방사형 배치
    const buildingCount = 6 + Math.floor(rng.random() * 4); // 6-9개 건물
    const angles = this.generateBuildingAngles(buildingCount, rng);

    for (let i = 0; i < buildingCount; i++) {
      const angle = angles[i];
      const distance = 15 + Math.floor(rng.random() * 15); // 15-30 블록 거리
      const x = centerX + Math.floor(Math.cos(angle) * distance);
      const z = centerZ + Math.floor(Math.sin(angle) * distance);

      // 건물 타입 선택
      const buildingType = this.selectBuildingType(rng);
      const building = this.generateBuilding(x, z, buildingType, rng);
      village.buildings.push(building);

      // 건물 내 주민 스폰
      const villagerCount = 1 + Math.floor(rng.random() * 2); // 1-2명
      for (let j = 0; j < villagerCount; j++) {
        const villager = this.spawnVillager(building, rng);
        village.villagers.push(villager);
      }
    }

    // 3. 마을 경계 울타리
    this.generateFence(village, rng);

    // 4. 월드에 메타데이터 저장
    this.world.setMetadata(`village_${centerX}_${centerZ}`, village);

    return village;
  }

  // 건물 각도 생성 (방사형)
  private generateBuildingAngles(count: number, rng: SeededRandom): number[] {
    const angles: number[] = [];
    const baseAngle = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const offset = (rng.random() - 0.5) * 0.5; // -0.25 ~ 0.25 라디안
      angles.push(baseAngle * i + offset);
    }

    return angles;
  }

  // 건물 타입 선택
  private selectBuildingType(rng: SeededRandom): BuildingType {
    const r = rng.random();
    if (r < 0.5) return BuildingType.HOUSE_SMALL;
    if (r < 0.75) return BuildingType.HOUSE_MEDIUM;
    if (r < 0.85) return BuildingType.HOUSE_LARGE;
    if (r < 0.92) return BuildingType.BLACKSMITH;
    return BuildingType.LIBRARY;
  }

  // 건물 생성
  private generateBuilding(x: number, z: number, type: BuildingType, rng: SeededRandom): Building {
    const pattern = BuildingPattern.getPattern(type);
    const rotation = Math.floor(rng.random() * 4) * 90; // 0, 90, 180, 270도

    const building: Building = {
      x, z,
      type,
      rotation,
      blocks: []
    };

    // 패턴 적용 (회전 고려)
    for (const block of pattern.blocks) {
      const rotated = this.rotateBlock(block, rotation);
      const worldX = x + rotated.x;
      const worldY = this.getGroundHeight(x, z) + rotated.y;
      const worldZ = z + rotated.z;

      this.world.setBlock(worldX, worldY, worldZ, rotated.blockId);
      building.blocks.push({x: worldX, y: worldY, z: worldZ, blockId: rotated.blockId});
    }

    return building;
  }

  // 블록 회전
  private rotateBlock(block: BlockData, rotation: number): BlockData {
    let {x, y, z, blockId} = block;

    // 90도 단위 회전 (Y축 기준)
    switch (rotation) {
      case 90:
        [x, z] = [-z, x];
        break;
      case 180:
        x = -x;
        z = -z;
        break;
      case 270:
        [x, z] = [z, -x];
        break;
    }

    // 회전에 따른 블록 ID 조정 (Door, Stairs 등)
    blockId = this.adjustBlockIdForRotation(blockId, rotation);

    return {x, y, z, blockId};
  }

  // 블록 ID 회전 조정
  private adjustBlockIdForRotation(blockId: number, rotation: number): number {
    // 문 방향: 2(남), 3(북), 4(서), 5(동)
    if (blockId >= 20 && blockId <= 23) { // Oak Door variants
      const baseId = blockId & 0xFC; // 상위 6비트 (타입)
      const direction = blockId & 0x03; // 하위 2비트 (방향)
      const newDirection = (direction + rotation / 90) % 4;
      return baseId | newDirection;
    }

    // 계단 방향: 0(남), 1(북), 2(서), 3(동)
    if (blockId >= 12 && blockId <= 15) { // Stone Stairs variants
      const baseId = blockId & 0xFC;
      const direction = blockId & 0x03;
      const newDirection = (direction + rotation / 90) % 4;
      return baseId | newDirection;
    }

    return blockId;
  }

  // 우물 생성
  private generateWell(x: number, z: number, village: Village): void {
    const wellPattern = BuildingPattern.getPattern(BuildingType.WELL);
    const wellHeight = this.getGroundHeight(x, z);

    for (const block of wellPattern.blocks) {
      const worldX = x + block.x;
      const worldY = wellHeight + block.y;
      const worldZ = z + block.z;

      this.world.setBlock(worldX, worldY, worldZ, block.blockId);
    }

    village.buildings.push({
      x, z,
      type: BuildingType.WELL,
      rotation: 0,
      blocks: wellPattern.blocks.map(b => ({
        x: x + b.x,
        y: wellHeight + b.y,
        z: z + b.z,
        blockId: b.blockId
      }))
    });
  }

  // 주민 스폰
  private spawnVillager(building: Building, rng: SeededRandom): Villager {
    // 건물 내부 랜덤 위치
    const indoorBlock = building.blocks.find(b => b.blockId === 0); // 빈 공간
    const spawnPos = indoorBlock || building.blocks[0];

    const villager = new Villager();
    villager.position.set(
      spawnPos.x + 0.5,
      spawnPos.y + 1,
      spawnPos.z + 0.5
    );

    // 직업 설정
    villager.profession = this.selectProfession(building.type, rng);

    return villager;
  }

  // 직업 선택
  private selectProfession(buildingType: BuildingType, rng: SeededRandom): Profession {
    switch (buildingType) {
      case BuildingType.BLACKSMITH: return Profession.BLACKSMITH;
      case BuildingType.LIBRARY: return Profession.LIBRARIAN;
      case BuildingType.FARMER: return Profession.FARMER;
      default: return Profession.FARMER;
    }
  }

  // 울타리 생성
  private generateFence(village: Village, rng: SeededRandom): void {
    const {center, radius} = village;

    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      const x = Math.floor(center.x + Math.cos(angle) * radius);
      const z = Math.floor(center.z + Math.sin(angle) * radius);
      const y = this.getGroundHeight(x, z);

      // 랜덤 간격으로 울타리 배치
      if (rng.random() > 0.3) {
        this.world.setBlock(x, y, z, 18); // Fence
        this.world.setBlock(x, y + 1, z, 18); // 2높이 울타리
      }
    }
  }

  // 지면 높이 가져오기
  private getGroundHeight(x: number, z: number): number {
    for (let y = 64; y >= 0; y--) {
      if (this.world.isSolidAt(x, y, z)) {
        return y + 1;
      }
    }
    return 0;
  }
}

// 마을 데이터 구조
interface Village {
  center: {x: number, z: number};
  buildings: Building[];
  villagers: Villager[];
  radius: number;
}

interface Building {
  x: number;
  z: number;
  type: BuildingType;
  rotation: number;
  blocks: {x: number, y: number, z: number, blockId: number}[];
}

enum BuildingType {
  HOUSE_SMALL = 'house_small',
  HOUSE_MEDIUM = 'house_medium',
  HOUSE_LARGE = 'house_large',
  BLACKSMITH = 'blacksmith',
  LIBRARY = 'library',
  WELL = 'well'
}

interface BlockData {
  x: number;
  y: number;
  z: number;
  blockId: number;
}
```

### BuildingPattern (건물 패턴 라이브러리)
```typescript
class BuildingPattern {
  private static patterns: Map<BuildingType, BuildingPatternData> = new Map();

  static initialize(): void {
    // 작은 집 (5x5x4)
    this.patterns.set(BuildingType.HOUSE_SMALL, {
      width: 5,
      height: 4,
      depth: 5,
      blocks: [
        // 바닥 (석재)
        {x: 0, y: 0, z: 0, blockId: 1}, {x: 1, y: 0, z: 0, blockId: 1},
        {x: 2, y: 0, z: 0, blockId: 1}, {x: 3, y: 0, z: 0, blockId: 1},
        {x: 4, y: 0, z: 0, blockId: 1},
        // ... (전체 패턴)

        // 벽 (참나무 판자)
        {x: 0, y: 1, z: 0, blockId: 8}, {x: 0, y: 2, z: 0, blockId: 8},
        {x: 4, y: 1, z: 0, blockId: 8}, {x: 4, y: 2, z: 0, blockId: 8},
        // ... (전체 패턴)

        // 문 (남향)
        {x: 2, y: 1, z: 0, blockId: 20}, // Door bottom
        {x: 2, y: 2, z: 0, blockId: 21}, // Door top

        // 창문 (유리)
        {x: 1, y: 2, z: 0, blockId: 11}, {x: 3, y: 2, z: 0, blockId: 11},

        // 지붕 (나무 판자)
        {x: -1, y: 3, z: -1, blockId: 9}, {x: 0, y: 3, z: -1, blockId: 9},
        {x: 1, y: 3, z: -1, blockId: 9}, {x: 2, y: 3, z: -1, blockId: 9},
        // ... (지붕 전체)
      ]
    });

    // 대장간 (7x6x5)
    this.patterns.set(BuildingType.BLACKSMITH, {
      width: 7,
      height: 6,
      depth: 6,
      blocks: [
        // 바닥 (석재 벽돌)
        // ...

        // 대장간 책상 (석재 + 흑연 블록)
        {x: 2, y: 1, z: 2, blockId: 1}, // Crafting Table (석재 표현)
        {x: 2, y: 2, z: 2, blockId: 24}, // Coal Block (장식)

        // 상자 (아이템 보관)
        {x: 3, y: 1, z: 1, blockId: 19}, // Chest

        // 용광로 (장식)
        {x: 1, y: 1, z: 3, blockId: 25}, // Furnace
        // ...
      ]
    });

    // 도서관 (8x8x6)
    this.patterns.set(BuildingType.LIBRARY, {
      width: 8,
      height: 6,
      depth: 8,
      blocks: [
        // 바닥 (나무 판자)
        // ...

        // 책장 (책장 블록 26)
        {x: 0, y: 1, z: 0, blockId: 26}, {x: 0, y: 2, z: 0, blockId: 26},
        {x: 0, y: 3, z: 0, blockId: 26},
        // ... (책장 전체)

        // 엔틱 테이블 (장식)
        {x: 4, y: 1, z: 4, blockId: 1},

        // 지도/지구본 (장식)
        {x: 4, y: 2, z: 4, blockId: 27}, // Globe/Map block
        // ...
      ]
    });

    // 우물 (5x3x5)
    this.patterns.set(BuildingType.WELL, {
      width: 5,
      height: 3,
      depth: 5,
      blocks: [
        // 우물 벽 (돌)
        {x: 0, y: 0, z: 0, blockId: 1}, {x: 1, y: 0, z: 0, blockId: 1},
        {x: 2, y: 0, z: 0, blockId: 1}, {x: 3, y: 0, z: 0, blockId: 1},
        {x: 4, y: 0, z: 0, blockId: 1},
        // ... (벽 전체)

        // 물 (우물 안)
        {x: 1, y: 1, z: 1, blockId: 13}, {x: 2, y: 1, z: 1, blockId: 13},
        {x: 3, y: 1, z: 1, blockId: 13},
        {x: 1, y: 1, z: 2, blockId: 13}, {x: 2, y: 1, z: 2, blockId: 13},
        {x: 3, y: 1, z: 2, blockId: 13},
        {x: 1, y: 1, z: 3, blockId: 13}, {x: 2, y: 1, z: 3, blockId: 13},
        {x: 3, y: 1, z: 3, blockId: 13},

        // 우물 지붕 (나무)
        {x: -1, y: 2, z: -1, blockId: 9}, {x: 0, y: 2, z: -1, blockId: 9},
        // ... (지붕)
      ]
    });
  }

  static getPattern(type: BuildingType): BuildingPatternData {
    return this.patterns.get(type)!;
  }
}

interface BuildingPatternData {
  width: number;
  height: number;
  depth: number;
  blocks: BlockData[];
}
```

### VillagerEntity
```typescript
class Villager extends Entity {
  // NPC 플래그
  isNPC: boolean = true;

  // 직업
  profession: Profession = Profession.FARMER;

  // Wander AI
  wanderState: WanderState = 'idle';
  wanderTarget: THREE.Vector3 | null = null;
  wanderCooldown: number = 0;
  wanderRange: number = 30; // 마을 내 배회 범위

  // 거래 데이터
  trades: TradeOffer[] = [];
  tradeCooldown: number = 0;

  // AI 업데이트
  updateAI(deltaTime: number, world: World): void {
    // 거래 쿨다운 감소
    if (this.tradeCooldown > 0) {
      this.tradeCooldown -= deltaTime;
    }

    // Wander AI
    this.updateWanderAI(deltaTime, world);
  }

  // Wander AI 업데이트
  private updateWanderAI(deltaTime: number, world: World): void {
    if (this.wanderCooldown > 0) {
      this.wanderCooldown -= deltaTime;
      return;
    }

    switch (this.wanderState) {
      case 'idle':
        // 1% 확률로 배회 시작
        if (Math.random() < 0.01) {
          this.wanderState = 'wandering';
          this.pickWanderTarget(world);
        }
        break;

      case 'wandering':
        if (this.wanderTarget) {
          const dist = this.position.distanceTo(this.wanderTarget);
          if (dist < 0.5) {
            // 도착
            this.wanderState = 'idle';
            this.wanderCooldown = 3 + Math.random() * 5; // 3-8초 대기
          } else {
            // 이동
            const direction = this.wanderTarget.clone().sub(this.position).normalize();
            this.velocity.x = direction.x * 0.5;
            this.velocity.z = direction.z * 0.5;
          }
        }
        break;
    }
  }

  // 배회 목표 선택
  private pickWanderTarget(world: World): void {
    // 마을 내 랜덤 위치
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * (this.wanderRange - 5);

    const targetX = Math.floor(this.position.x + Math.cos(angle) * distance);
    const targetZ = Math.floor(this.position.z + Math.sin(angle) * distance);
    const targetY = this.getGroundHeight(targetX, targetZ, world);

    this.wanderTarget = new THREE.Vector3(targetX + 0.5, targetY + 1, targetZ + 0.5);
  }

  // 지면 높이 가져오기
  private getGroundHeight(x: number, z: number, world: World): number {
    for (let y = 64; y >= 0; y--) {
      if (world.isSolidAt(x, y, z)) {
        return y + 1;
      }
    }
    return 0;
  }

  // 거래 가능 여부
  canTrade(): boolean {
    return this.tradeCooldown <= 0;
  }

  // 거래 실행
  trade(playerInventory: Inventory, tradeIndex: number): boolean {
    if (!this.canTrade()) return false;
    if (tradeIndex < 0 || tradeIndex >= this.trades.length) return false;

    const trade = this.trades[tradeIndex];

    // 플레이어가 에메랄드를 가지고 있는지 확인
    const emeraldStack = playerInventory.findStackByItemId(16); // Emerald
    if (!emeraldStack || emeraldStack.count < trade.cost) {
      return false;
    }

    // 인벤토리 공간 확인
    if (!playerInventory.canAddItem(trade.item)) {
      return false;
    }

    // 거래 실행
    emeraldStack.count -= trade.cost;
    if (emeraldStack.count === 0) {
      playerInventory.removeStack(emeraldStack);
    }

    playerInventory.addItem(trade.item);

    // 거래 쿨다운
    this.tradeCooldown = 2; // 2초

    // 거래 후 새로운 오퍼 생성 (무한 거래 아님)
    this.regenerateTrade(tradeIndex);

    return true;
  }

  // 새로운 거래 오퍼 생성
  private regenerateTrade(index: number): void {
    this.trades[index] = TradeSystem.generateTrade(this.profession);
  }
}

// Wander 상태
type WanderState = 'idle' | 'wandering';

// 직업 enum
enum Profession {
  FARMER = 'farmer',
  BLACKSMITH = 'blacksmith',
  LIBRARIAN = 'librarian'
}

// 거래 오퍼
interface TradeOffer {
  cost: number; // 에메랄드 개수
  item: ItemStack;
}
```

### TradeSystem
```typescript
class TradeSystem {
  // 직업별 거래 오퍼 생성
  static generateTrade(profession: Profession): TradeOffer {
    const rng = Math.random();

    switch (profession) {
      case Profession.FARMER:
        if (rng < 0.3) {
          return {cost: 1, item: {itemId: 28, count: 16}}; // Wheat
        } else if (rng < 0.6) {
          return {cost: 1, item: {itemId: 29, count: 10}}; // Carrot
        } else {
          return {cost: 1, item: {itemId: 30, count: 8}}; // Potato
        }

      case Profession.BLACKSMITH:
        if (rng < 0.4) {
          return {cost: 5, item: {itemId: 31, count: 1}}; // Iron Ingot
        } else if (rng < 0.7) {
          return {cost: 10, item: {itemId: 32, count: 1}}; // Gold Ingot
        } else {
          return {cost: 1, item: {itemId: 33, count: 1}}; // Coal
        }

      case Profession.LIBRARIAN:
        if (rng < 0.5) {
          return {cost: 3, item: {itemId: 34, count: 3}}; // Paper
        } else if (rng < 0.8) {
          return {cost: 5, item: {itemId: 35, count: 1}}; // Book
        } else {
          return {cost: 8, item: {itemId: 36, count: 1}}; // Enchantment Table
        }

      default:
        return {cost: 1, item: {itemId: 28, count: 16}}; // Default: Wheat
    }
  }

  // 주민 초기 거래 세트 생성
  static generateTradeSet(profession: Profession): TradeOffer[] {
    const trades: TradeOffer[] = [];

    // 3-5개 거래 오퍼 생성
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      trades.push(this.generateTrade(profession));
    }

    return trades;
  }
}
```

## 핵심 로직

### 1. 마을 생성 트리거 (TerrainGenerator 통합)
```typescript
// TerrainGenerator.ts
generateChunk(chunkX: number, chunkZ: number): void {
  super.generateChunk(chunkX, chunkZ);

  // 마을 생성 트리거
  if (this.shouldSpawnVillage(chunkX, chunkZ)) {
    const centerX = chunkX * 16 + 8;
    const centerZ = chunkZ * 16 + 8;
    const seed = this.getVillageSeed(chunkX, chunkZ);

    const villageGenerator = new VillageGenerator(this.world);
    villageGenerator.generate(centerX, centerZ, seed);
  }
}

// 마을 스폰 조건
private shouldSpawnVillage(chunkX: number, chunkZ: number): boolean {
  // 100x100 청크당 1개 마을 (약 1% 확률)
  const gridSize = 100;
  const gridX = Math.floor(chunkX / gridSize);
  const gridZ = Math.floor(chunkZ / gridSize);

  const gridIndex = gridX * 1000 + gridZ; // 유니크 인덱스

  // 시드 기반 결정
  const rng = new SeededRandom(this.seed + gridIndex);
  return rng.random() < 0.01;
}

private getVillageSeed(chunkX: number, chunkZ: number): number {
  return this.seed + chunkX * 1000 + chunkZ;
}
```

### 2. 주민 클릭 시 거래 UI 호출
```typescript
// Game.ts
onRightClick(blockX, blockY, blockZ): void {
  // 주민 엔티티 확인
  const clickedEntity = this.entityManager.getEntityAtPosition(
    new THREE.Vector3(blockX + 0.5, blockY + 0.5, blockZ + 0.5)
  );

  if (clickedEntity instanceof Villager && clickedEntity.isNPC) {
    // 거래 UI 열기
    this.openTradeUI(clickedEntity);
    return;
  }

  // 기존 블록 상호작용
  // ...
}

// 거래 UI 열기
openTradeUI(villager: Villager): void {
  if (!villager.canTrade()) {
    showNotification("아직 거래할 수 없습니다.");
    return;
  }

  // 거래 데이터 전달
  this.tradeUI.open(villager.trades, (tradeIndex) => {
    const success = villager.trade(this.player.inventory, tradeIndex);
    if (success) {
      showNotification("거래 완료!");
    } else {
      showNotification("거 실패 (에메랄드 부족 또는 인벤토리 꽉 참)");
    }
  });
}
```

### 3. 주민 업데이트 루프
```typescript
// Game.ts 메인 루프
update(deltaTime: number): void {
  super.update(deltaTime);

  // 주민 엔티티 업데이트
  const villagers = this.entityManager.getEntitiesByType(Villager);
  for (const villager of villagers) {
    if (villager.isNPC) {
      villager.updateAI(deltaTime, this.world);
    }
  }
}
```

## 충돌/의존성
- **TerrainGenerator.ts 의존성**: VillageGenerator 통합, 마을 생성 트리거. 기존 지형 생성과 충돌하지 않도록 주의
- **Entity.ts 의존성**: Villager 상속, isNPC 플래그 추가. 대형 엔티티 지원과 호환되어야 함
- **EntityManager.ts 의존성**: Villager 등록 및 관리. NPC 엔티티와 일반 엔티티 구분 필요
- **Game.ts 의존성**: 거래 UI 호출, Villager 클릭 이벤트. 기존 상호작용과 충돌하지 않도록 조건 분기
- **Inventory.ts 의존성**: 에메랄드 아이템(16) 추가, 거래 인벤토리. 기존 슬롯 시스템과 호환
- **의존성 블록**: Door(20-23), Chest(19), Stairs(12-15), Fence(18), Glass(11), Coal Block(24), Furnace(25), Bookshelf(26) 등
- **충돌 위험**: 마을이 너무 자주 생성되면 월드가 난잡해질 수 있음. 스폰 확률(1%)과 최소 거리(100 청크) 설정 필요
- **성능 고려**: 많은 주민 엔티티가 존재하면 Wander AI가 성능에 영향을 줄 수 있음. AI 업데이트 빈도 제한 필요

## 테스트 방법

### 1. 단위 테스트 (VillageGenerator.test.ts)
```typescript
describe('VillageGenerator', () => {
  test('should generate village with well at center', () => {
    const world = new World();
    const generator = new VillageGenerator(world);
    const village = generator.generate(0, 0, 12345);

    expect(village.buildings.length).toBeGreaterThan(0);
    expect(village.buildings[0].type).toBe(BuildingType.WELL);
    expect(village.center.x).toBe(0);
    expect(village.center.z).toBe(0);
  });

  test('should generate 6-9 buildings', () => {
    const world = new World();
    const generator = new VillageGenerator(world);
    const village = generator.generate(0, 0, 12345);

    expect(village.buildings.length).toBeGreaterThanOrEqual(6);
    expect(village.buildings.length).toBeLessThanOrEqual(9);
  });

  test('should spawn villagers in buildings', () => {
    const world = new World();
    const generator = new VillageGenerator(world);
    const village = generator.generate(0, 0, 12345);

    expect(village.villagers.length).toBeGreaterThan(0);
    village.villagers.forEach(v => {
      expect(v instanceof Villager).toBe(true);
      expect(v.isNPC).toBe(true);
    });
  });

  test('should rotate blocks correctly', () => {
    const world = new World();
    const generator = new VillageGenerator(world);
    const block = {x: 1, y: 0, z: 0, blockId: 20}; // Door (south-facing)

    const rotated = generator['rotateBlock'](block, 90); // Rotate 90 degrees

    expect(rotated.x).toBe(0);
    expect(rotated.z).toBe(-1);
    expect(rotated.blockId).toBe(21); // East-facing door
  });
});

describe('TradeSystem', () => {
  test('should generate farmer trade', () => {
    const trade = TradeSystem.generateTrade(Profession.FARMER);

    expect(trade.cost).toBeGreaterThan(0);
    expect(trade.item.itemId).toBeOneOf([28, 29, 30]); // Wheat, Carrot, Potato
  });

  test('should generate blacksmith trade', () => {
    const trade = TradeSystem.generateTrade(Profession.BLACKSMITH);

    expect(trade.cost).toBeGreaterThan(0);
    expect(trade.item.itemId).toBeOneOf([31, 32, 33]); // Iron, Gold, Coal
  });

  test('should generate trade set with 3-5 trades', () => {
    const trades = TradeSystem.generateTradeSet(Profession.FARMER);

    expect(trades.length).toBeGreaterThanOrEqual(3);
    expect(trades.length).toBeLessThanOrEqual(5);
  });
});
```

### 2. 통합 테스트
- 마을 생성: TerrainGenerator가 올바른 위치에 마을을 생성하는지 확인
- 건물 배치: 중심 우물 기준 방사형으로 건물이 배치되는지 확인
- 블록 회전: 각 건물이 무작위 회전(0, 90, 180, 270)을 갖는지 확인
- 주민 스폰: 각 건물 내에 주민이 스폰되는지 확인
- Wander AI: 주민이 마을 내에서 배회하는지 확인
- 거래 UI: 주민 클릭 시 거래 UI가 열리는지 확인
- 거래 실행: 에메랄드로 아이템을 교환할 수 있는지 확인
- 거래 쿨다운: 거래 후 쿨다운이 적용되는지 확인

### 3. 수동 테스트 시나리오
1. 새로운 월드 생성
2. 마을 위치 확인 (월드에서 이동하며 마을 찾기)
3. 마을 중심에 우물이 있는지 확인
4. 주변에 집, 대장간, 도서관이 배치되어 있는지 확인
5. 주민들이 마을 내를 배회하는지 확인
6. 주민 클릭 시 거래 UI가 열리는지 확인
7. 에메랄드(다이아몬드 채굴로 획득)로 거래 가능한지 확인
8. 거래 후 인벤토리에 아이템이 추가되는지 확인
9. 여러 거래 후 쿨다운이 적용되는지 확인
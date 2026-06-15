# 25. 지하 던전 자동 생성 (Dungeon Generator)

## 개요
청크 생성 시 낮은 확률로 지하 구조물인 던전을 자동으로 배치하는 시스템을 구현한다. 방과 복도로 구성된 던전 내에 좀비 스포너와 보물상자를 배치하며, 플레이어에게 도전 과제와 보상을 제공한다.

## 구현 범위
- StructureGenerator 클래스 생성 (방/복도/스포너/보물 배치)
- TerrainGenerator와 통합 (청크 생성 시 던전 생성 확률 적용)
- 카빙 시스템 (stone 영역을 air로 변환 후 구조물 배치)
- 좀비 스포너 블록 (반경 내 지속 스폰)
- 보물상자(#18) 희귀 아이템 확률 드롭

## 수정 대상 파일
- `src/world/TerrainGenerator.ts`: 던전 생성 확률 적용
- `src/entities/Entity.ts`: 좀비 스포너 로직
- `src/data/Block.ts`: Spawner 블록 ID 추가
- `src/inventory/Inventory.ts`: 보물상자 아이템 드롭 로직

## 추가 파일
- `src/structures/StructureGenerator.ts`: 던전 구조물 생성 클래스
- `src/structures/DungeonLayout.ts`: 방/복도 레이아웃 정의
- `src/structures/Spawner.ts`: 몹 스포너 시스템

## 데이터 구조
```typescript
// 던전 구성 요소
interface DungeonRoom {
  position: Vector3;
  size: Vector3;      // width, height, depth
  type: 'entrance' | 'corridor' | 'hall' | 'boss';
  connections: number[];  // 연결된 방 인덱스
}

interface DungeonLayout {
  rooms: DungeonRoom[];
  entranceRoom: number;
  spawnerPositions: Vector3[];
  chestPositions: Vector3[];
}

// 스포너 설정
interface SpawnerConfig {
  position: Vector3;
  entityType: BlockId.Zombie | BlockId.Skeleton;
  spawnRate: number;      // 초당 스폰 확률 (0.0-1.0)
  maxMobs: number;        // 동시 스폰 최대 수
  spawnRadius: number;    // 스폰 반경
  activationRange: number; // 플레이어 감지 반경
}

// 보물상자 드롭 테이블
interface LootTable {
  item: BlockId;
  probability: number;    // 0.0-1.0
  countMin: number;
  countMax: number;
}
```

## 핵심 로직

### 1. 던전 생성 확률 적용
```typescript
// TerrainGenerator.ts
class TerrainGenerator {
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);

    // 기존 테레인 생성
    this.generateBaseTerrain(chunk);

    // 던전 생성 확률 (2%)
    if (Math.random() < 0.02) {
      const dungeon = this.structureGenerator.generateDungeon(
        chunkX * 16 + Math.random() * 16,
        Math.random() * 40 + 10,  // y: 10-50 (지하)
        chunkZ * 16 + Math.random() * 16
      );

      this.carveDungeon(chunk, dungeon);
    }

    return chunk;
  }
}
```

### 2. StructureGenerator 기본 구조
```typescript
// StructureGenerator.ts
class StructureGenerator {
  generateDungeon(x: number, y: number, z: number): DungeonLayout {
    const layout: DungeonLayout = {
      rooms: [],
      entranceRoom: 0,
      spawnerPositions: [],
      chestPositions: []
    };

    // 1. 입구 방 생성
    const entrance: DungeonRoom = {
      position: { x, y, z },
      size: { x: 8, y: 5, z: 8 },
      type: 'entrance',
      connections: []
    };
    layout.rooms.push(entrance);

    // 2. 방 추가 (3-6개)
    const roomCount = Math.floor(Math.random() * 4) + 3;
    for (let i = 1; i < roomCount; i++) {
      const parentRoom = layout.rooms[Math.floor(Math.random() * i)];
      const newRoom = this.generateConnectedRoom(parentRoom, i);

      layout.rooms.push(newRoom);
      parentRoom.connections.push(i);
    }

    // 3. 보스 방 추가
    const lastRoom = layout.rooms[layout.rooms.length - 1];
    lastRoom.type = 'boss';

    // 4. 스포너 배치 (각 방에 1-2개)
    layout.rooms.forEach((room, idx) => {
      if (room.type === 'entrance') return;

      const spawnerCount = room.type === 'boss' ? 3 : 1;
      for (let s = 0; s < spawnerCount; s++) {
        const spawnerPos = this.getRandomPositionInRoom(room, 1);
        layout.spawnerPositions.push(spawnerPos);
      }
    });

    // 5. 보물상자 배치 (30% 확률)
    layout.rooms.forEach((room, idx) => {
      if (Math.random() < 0.3) {
        const chestPos = this.getRandomPositionInRoom(room, 0);
        layout.chestPositions.push(chestPos);
      }
    });

    return layout;
  }
}
```

### 3. 방 연결 생성
```typescript
// StructureGenerator.ts
function generateConnectedRoom(parent: DungeonRoom, roomIndex: number): DungeonRoom {
  // 방 크기 랜덤 (5-10 x 4-6 x 5-10)
  const size = {
    x: Math.floor(Math.random() * 6) + 5,
    y: Math.floor(Math.random() * 3) + 4,
    z: Math.floor(Math.random() * 6) + 5
  };

  // 방향 결정 (북/남/동/서)
  const direction = Math.floor(Math.random() * 4);

  // 부모 방 벽 중앙에서 이동
  let position: Vector3;

  switch (direction) {
    case 0: // 북
      position = {
        x: parent.position.x - size.x / 2,
        y: parent.position.y,
        z: parent.position.z - parent.size.z / 2 - 4
      };
      break;
    case 1: // 남
      position = {
        x: parent.position.x - size.x / 2,
        y: parent.position.y,
        z: parent.position.z + parent.size.z / 2 + 4
      };
      break;
    case 2: // 동
      position = {
        x: parent.position.x + parent.size.x / 2 + 4,
        y: parent.position.y,
        z: parent.position.z - size.z / 2
      };
      break;
    case 3: // 서
      position = {
        x: parent.position.x - parent.size.x / 2 - 4,
        y: parent.position.y,
        z: parent.position.z - size.z / 2
      };
      break;
  }

  return {
    position,
    size,
    type: roomIndex === 1 ? 'corridor' : 'hall',
    connections: [layout.rooms.indexOf(parent)]
  };
}

function getRandomPositionInRoom(room: DungeonRoom, offsetY: number): Vector3 {
  return {
    x: room.position.x + Math.random() * room.size.x,
    y: room.position.y + offsetY,
    z: room.position.z + Math.random() * room.size.z
  };
}
```

### 4. 던전 카빙
```typescript
// TerrainGenerator.ts
function carveDungeon(chunk: Chunk, layout: DungeonLayout): void {
  // 1. stone 영역을 air로 변환
  layout.rooms.forEach(room => {
    for (let x = 0; x < room.size.x; x++) {
      for (let y = 0; y < room.size.y; y++) {
        for (let z = 0; z < room.size.z; z++) {
          const bx = Math.floor(room.position.x + x);
          const by = Math.floor(room.position.y + y);
          const bz = Math.floor(room.position.z + z);

          if (chunk.isInBounds(bx, by, bz)) {
            // 바닥과 천장은 유지 (stone)
            if (y === 0 || y === room.size.y - 1) {
              chunk.setBlock(bx, by, bz, BlockId.Stone);
            } else {
              chunk.setBlock(bx, by, bz, BlockId.Air);
            }
          }
        }
      }
    }
  });

  // 2. 벽/기둥 배치 (Cobblestone)
  layout.rooms.forEach(room => {
    // 기둥 (모서리)
    const corners = [
      [0, 0], [room.size.x-1, 0],
      [0, room.size.z-1], [room.size.x-1, room.size.z-1]
    ];

    corners.forEach(([cx, cz]) => {
      for (let y = 1; y < room.size.y - 1; y++) {
        const bx = Math.floor(room.position.x + cx);
        const by = Math.floor(room.position.y + y);
        const bz = Math.floor(room.position.z + cz);
        chunk.setBlock(bx, by, bz, BlockId.Cobblestone);
      }
    });
  });

  // 3. 스포너 배치
  layout.spawnerPositions.forEach(pos => {
    const bx = Math.floor(pos.x);
    const by = Math.floor(pos.y);
    const bz = Math.floor(pos.z);
    chunk.setBlock(bx, by, bz, BlockId.Spawner);
  });

  // 4. 보물상자 배치
  layout.chestPositions.forEach(pos => {
    const bx = Math.floor(pos.x);
    const by = Math.floor(pos.y);
    const bz = Math.floor(pos.z);
    chunk.setBlock(bx, by, bz, BlockId.Chest);
  });
}
```

### 5. 좀비 스포너 로직
```typescript
// Spawner.ts
class Spawner {
  private spawnedMobs: Entity[] = [];
  private lastSpawnTime = 0;

  update(deltaTime: number, player: Entity): void {
    // 플레이어가 감지 반경 내인지 확인
    const distance = this.position.distanceTo(player.position);

    if (distance > this.config.activationRange) {
      return;  // 감지 범위 밖
    }

    // 최대 스폰 수 확인
    const activeMobs = this.spawnedMobs.filter(mob => !mob.isDead).length;
    if (activeMobs >= this.config.maxMobs) {
      return;  // 최대 스폰 도달
    }

    // 스폰 확률 체크
    if (Math.random() < this.config.spawnRate * deltaTime) {
      this.spawnMob();
    }

    // 죽은 몹 정리
    this.spawnedMobs = this.spawnedMobs.filter(mob => !mob.isDead);
  }

  spawnMob(): void {
    // 스폰 반경 내 랜덤 위치
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.config.spawnRadius;

    const spawnPos = {
      x: this.position.x + Math.cos(angle) * radius,
      y: this.position.y,
      z: this.position.z + Math.sin(angle) * radius
    };

    // 좀비 엔티티 생성
    const zombie = new Zombie(spawnPos);
    zombie.target = this.findNearestPlayer();

    this.spawnedMobs.push(zombie);
    this.world.addEntity(zombie);
  }

  findNearestPlayer(): Entity | null {
    let nearest = null;
    let minDist = Infinity;

    this.world.players.forEach(player => {
      const dist = this.position.distanceTo(player.position);
      if (dist < minDist && dist < this.config.activationRange) {
        minDist = dist;
        nearest = player;
      }
    });

    return nearest;
  }
}
```

### 6. 보물상자 아이템 드롭
```typescript
// Inventory.ts
const DUNGEON_LOOT_TABLE: LootTable[] = [
  { item: BlockId.DiamondOre, probability: 0.15, countMin: 1, countMax: 3 },
  { item: BlockId.GoldOre, probability: 0.30, countMin: 2, countMax: 5 },
  { item: BlockId.IronIngot, probability: 0.50, countMin: 4, countMax: 8 },
  { item: BlockId.Apple, probability: 0.70, countMin: 2, countMax: 4 },
  { item: BlockId.Arrow, probability: 0.80, countMin: 8, countMax: 16 }
];

function openDungeonChest(chest: ChestBlock): ItemStack[] {
  const drops: ItemStack[] = [];

  // 각 아이템에 대해 확률 적용
  DUNGEON_LOOT_TABLE.forEach(loot => {
    if (Math.random() < loot.probability) {
      const count = Math.floor(Math.random() * (loot.countMax - loot.countMin + 1)) + loot.countMin;
      drops.push({
        item: loot.item,
        count,
        metadata: { source: 'dungeon' }
      });
    }
  });

  // 최소 1개 보장
  if (drops.length === 0) {
    drops.push({
      item: BlockId.Cobblestone,
      count: 10,
      metadata: { source: 'dungeon' }
    });
  }

  chest.isEmpty = true;
  return drops;
}
```

## 충돌/의존성

### 충돌 포인트
- **TerrainGenerator**: 기존 지형 생성 로직에 던전 카빙 통합
- **Entity 시스템**: 스포너에서 생성된 몹과 플레이어 상호작용
- **Block 시스템**: Spawner 블록 ID 및 속성 추가

### 의존성
- `SimplexNoise`: 던전 위치 결정 시 노이즈 활용 가능
- `Entity`: 좀비/스켈레톤 엔티티
- `Inventory`: 보물상자 아이템 시스템
- `Chunk`: 블록 데이터 수정

## 테스트 방법

### 단위 테스트
1. **StructureGenerator**: 방 연결 로직, 스포너/보물 배치 검증
2. **Spawner**: 스폰 확률, 최대 스폰 수, 감지 반경 테스트
3. **보물 드롭**: 확률 분포, 개수 범위 확인

### 통합 테스트
1. **던전 생성**: 청크 생성 시 던전 배치 확인
2. **카빙**: stone 영역이 올바르게 air로 변환되는지 확인
3. **스포너 작동**: 플레이어 접근 시 좀비 스폰, 범위 밖에서 중단
4. **보물상자**: 상자 열기 시 아이템 드롭 확인

### 엣지 케이스
- 던전이 청크 경계를 넘을 때 처리
- 스포너가 레어아이템만 드롭할 때 밸런스
- 복도가 서로 겹칠 때 처리
- 보스방 스포너 과다 스폰 방지
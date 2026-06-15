# 24. 계단 블록 (Stairs)

## 개요
큐브 형태의 기존 블록과 달리 계단 형태의 3D 메시를 가진 블록을 구현한다. 플레이어가 계단을 오르내릴 수 있으며, 8방향으로 회전 배치가 가능하다. 석재/목재 재료로 제작 가능하며, 건물 디자인의 다양성을 확장한다.

## 구현 범위
- L자형 계단 형태의 커스텀 지오메트리 생성 (8개 삼각형)
- MeshBuilder에 Stairs 블록 타입 감지 및 메시 생성 로직 추가
- 슬랩 충돌 처리 (반 블록 높이: 0.5, 1.0 계단)
- 8방향 회전 시스템 (비트 마스크 또는 blockStates)
- 제작 레시피 (Stone/Wood 3개)

## 수정 대상 파일
- `src/core/MeshBuilder.ts`: Stairs 블록 감지 및 커스텀 메시 생성
- `src/physics/Physics.ts`: 슬랩 충돌 처리 로직 추가
- `src/entities/Entity.ts`: 계단 오르내리기 물리 보정
- `src/data/Block.ts`: BlockId.Stairs 추가, 방향 속성
- `src/crafting/Recipes.ts`: 계단 제작 레시피 등록

## 추가 파일
- `src/meshes/StairsGeometry.ts`: 계단 지오메트리 생성 클래스
- `src/constants/BlockRotation.ts`: 8방향 회전 상수 정의

## 데이터 구조
```typescript
// 블록 방향 비트 마스크 (3비트)
enum StairDirection {
  NORTH = 0,      // 000
  EAST = 1,       // 001
  SOUTH = 2,      // 010
  WEST = 3,       // 011
  UP_NORTH = 4,   // 100 (반계단 위쪽)
  UP_EAST = 5,    // 101
  UP_SOUTH = 6,   // 110
  UP_WEST = 7     // 111
}

// 블록 데이터 확장
interface BlockData {
  type: BlockId;
  direction?: StairDirection;  // 0-7
  isTopHalf?: boolean;         // 반계단 위치
}

// 슬랩 충돌 박스
interface SlabAABB {
  baseMin: Vector3;   // 하단
  baseMax: Vector3;   // 하단 상단 (y+0.5)
  topMin: Vector3;    // 상단
  topMax: Vector3;    // 상단 상단 (y+1.0)
}
```

## 핵심 로직

### 1. 계단 지오메트리 생성
```typescript
// StairsGeometry.ts
function buildStairMesh(direction: StairDirection, isTopHalf: boolean): Float32Array {
  const vertices = [];

  // 기초 L자형 형태 (북향 기준)
  const baseVertices = [
    // 하단 삼각형 4개
    [0,0,0], [1,0,0], [0,0.5,0],
    [1,0,0], [1,0.5,0], [0,0.5,0],
    [0,0,0], [1,0,0], [0,0,1],
    [1,0,0], [1,0,1], [0,0,1],
    // 상단 삼각형 4개
    [0,0.5,0], [1,0.5,0], [0,1,0],
    [1,0.5,0], [1,1,0], [0,1,0],
    [0,0.5,0], [0,1,0], [0,0.5,1],
    [0,0.5,1], [0,1,0], [0,1,1],
  ];

  // 방향별 회전 변환
  const rotated = rotateVertices(baseVertices, direction);

  // 반계단 높이 조정
  if (isTopHalf) {
    rotated.forEach(v => v[1] += 0.5);
  }

  return new Float32Array(rotated.flat());
}

function rotateVertices(vertices: number[][], dir: StairDirection): number[][] {
  // 90도 회전 매트릭스 적용
  const angle = (dir % 4) * (Math.PI / 2);
  return vertices.map(([x, y, z]) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      x * cos - z * sin,
      y,
      x * sin + z * cos
    ];
  });
}
```

### 2. MeshBuilder 통합
```typescript
// MeshBuilder.ts
function buildChunkMesh(chunk: Chunk): BufferGeometry {
  const vertices = [];
  const colors = [];

  for (let y = 0; y < 64; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const blockId = chunk.getBlock(x, y, z);

        if (blockId === BlockId.Stairs) {
          const data = chunk.getBlockData(x, y, z);
          const stairVerts = buildStairMesh(data.direction, data.isTopHalf);
          vertices.push(...stairVerts);
          colors.push(...getStairColors(blockId));
          continue;
        }

        // 기존 큐브 블록 처리
        buildCubeFaces(x, y, z, chunk, vertices, colors);
      }
    }
  }

  return createGeometry(vertices, colors);
}
```

### 3. 슬랩 충돌 처리
```typescript
// Physics.ts
function checkStairCollision(entity: Entity, block: BlockData): CollisionResult {
  const slabAABB = getSlabAABB(block.position, block.direction, block.isTopHalf);

  // 하단 확인 (y+0.5)
  const baseCollision = checkAABBCollision(entity.aabb, {
    min: slabAABB.baseMin,
    max: slabAABB.baseMax
  });

  // 상단 확인 (y+1.0)
  const topCollision = checkAABBCollision(entity.aabb, {
    min: slabAABB.topMin,
    max: slabAABB.topMax
  });

  // 충돌 위치에 따른 처리
  if (baseCollision && !topCollision) {
    // 하단에만 충돌: 반계단에서 정지
    entity.velocity.y = 0;
    entity.position.y = slabAABB.baseMax.y - entity.aabb.min.y;
  } else if (!baseCollision && topCollision) {
    // 상단에만 충돌: 계단 위에 서 있음
    entity.velocity.y = 0;
    entity.onGround = true;
  }

  return { collided: baseCollision || topCollision };
}

function getSlabAABB(pos: Vector3, dir: StairDirection, isTop: boolean): SlabAABB {
  const halfHeight = 0.5;
  const yOffset = isTop ? 0.5 : 0;

  // 방향별 L자 형태 AABB 계산
  const [baseMin, baseMax, topMin, topMax] = calculateLShapeAABB(
    pos.x, pos.y + yOffset, pos.z, dir, halfHeight
  );

  return { baseMin, baseMax, topMin, topMax };
}
```

### 4. 계단 오르내리기
```typescript
// Entity.ts
function updateOnStairs(entity: Entity, stairBlock: BlockData): void {
  // 계단 위에서 걷기
  if (entity.onGround && isStandingOnStair(entity, stairBlock)) {
    // 경사에 따른 수평 속도 감쇠
    entity.velocity.x *= 0.9;
    entity.velocity.z *= 0.9;

    // 자동 오르내림 (입력 없어도 경사를 타고 이동)
    if (Math.abs(entity.velocity.y) < 0.1) {
      entity.velocity.y += 0.15;  // 약간의 상승력
    }
  }

  // 계단에서 점프
  if (entity.jumping && isStandingOnStair(entity, stairBlock)) {
    entity.velocity.y = entity.jumpForce * 1.1;  // 10% 높게
    entity.jumping = false;
  }
}
```

### 5. 제작 레시피
```typescript
// Recipes.ts
const STAIRS_RECIPES = [
  {
    result: { item: BlockId.Stairs, count: 4 },
    pattern: [
      ['S', ''],
      ['S', 'S'],
      ['S', 'S']
    ],
    ingredients: {
      'S': { item: BlockId.Stone }
    }
  },
  {
    result: { item: BlockId.Stairs, count: 4, variant: 'wood' },
    pattern: [
      ['W', ''],
      ['W', 'W'],
      ['W', 'W']
    ],
    ingredients: {
      'W': { item: BlockId.Wood }
    }
  }
];
```

## 충돌/의존성

### 충돌 포인트
- **MeshBuilder**: 기존 큐브 메시 로직과 분리 필요
- **Physics**: AABB 충돌 시스템 확장, 슬랩 충돌 추가
- **Entity**: 이동 로직 수정, 계단 특수 처리

### 의존성
- `BlockId`: Stairs 블록 ID 정의 필요
- `ChunkData`: 블록 방향 데이터 저장 확장
- `Geometry`: Three.js BufferGeometry API

## 테스트 방법

### 단위 테스트
1. **지오메트리 생성**: 8방향 회전별 정점 좌표 검증
2. **슬랩 AABB**: 각 방향별 충돌 박스 크기 확인
3. **충돌 감지**: 다른 높이에서 계단 접근 시 충돌 확인

### 통합 테스트
1. **제작**: 재료 배치 후 계단 생성 확인
2. **배치**: 플레이서로 방향별 설치 테스트
3. **이동**: 계단 오르내리기, 점프, 달리기 테스트
4. **연속 계단**: 다단 계단 구조에서 자연스러운 이동 확인

### 엣지 케이스
- 계단 위에서 떨어질 때 물리 처리
- 벽에 붙은 계단 설치
- 청크 경계에 걸친 계단
- 역방향 계단 연결
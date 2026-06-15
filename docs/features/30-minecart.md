# 30. 마인카트 시스템 (Minecart System)

## 개요
레일 블록과 마인카트 엔티티를 구현하여 플레이어가 레일을 타고 이동할 수 있는 시스템을 만든다. 마인카트는 레일 위에서만 이동하며, 경사에서 중력의 영향을 받아 가속한다.

## 구현 범위
- 레일 블록(Rail=22): 수평 레일, 경사 레일 (Stairs와 연동)
- 카트 엔티티: 레일 위에서만 이동, 중력 영향 (경사에서 가속)
- 플레이어 탑승: #29 Horse Riding과 동일 방식
- 레일 경로 탐색: 인접 레일 블록을 따라 방향 결정
- 레시피: IronIngot 6 (레일), IronIngot 5 (카트)

## 수정 대상 파일
- `src/entities/Player.ts`: riding 추가, 카트 탑승/하차
- `src/entities/Entity.ts`: MinecartEntity 추가
- `src/data/Block.ts`: 레일 블록 ID 추가
- `src/physics/Physics.ts`: 레일 물리 (가속/감속)
- `src/world/World.ts`: 레일 블록 감지, 경로 탐색

## 추가 파일
- `src/entities/MinecartEntity.ts`: 마인카트 엔티티
- `src/blocks/RailBlock.ts`: 레일 블록 클래스
- `src/rails/RailPathfinder.ts`: 레일 경로 탐색
- `src/rails/RailPhysics.ts`: 레일 물리 시뮬레이션

## 데이터 구조
```typescript
// 레일 블록
interface RailBlock extends Block {
  id: BlockId.Rail;
  direction: RailDirection;     // 레일 방향
  isSloped: boolean;             // 경사 여부
  slopeDirection: RailDirection; // 경사 방향
}

// 레일 방향
enum RailDirection {
  NORTH_SOUTH = 0,  // 남북
  EAST_WEST = 1,    // 동서
  ASCENDING_EAST = 2,   // 동쪽 올라감
  ASCENDING_WEST = 3,   // 서쪽 올라감
  ASCENDING_NORTH = 4,  // 북쪽 올라감
  ASCENDING_SOUTH = 5   // 남쪽 올라감
}

// 마인카트 엔티티
interface MinecartEntity extends Entity {
  velocity: Vector3;
  maxSpeed: number;        // 최대 속도
  friction: number;        // 마찰력
  gravity: number;         // 중력 가속도
  onRail: boolean;         // 레일 위 여부
  railBlock: RailBlock | null;  // 현재 레일
}

// 탑승 상태 (Horse Riding과 공유)
interface RidingState {
  isRiding: boolean;
  mount: Entity | null;
  mountOffset: Vector3;
  mountAngle: number;
}
```

## 핵심 로직

### 1. 레일 블록 정의
```typescript
// RailBlock.ts
class RailBlock {
  public id = BlockId.Rail;
  public direction: RailDirection;
  public isSloped = false;
  public slopeDirection: RailDirection;

  constructor(direction: RailDirection = RailDirection.NORTH_SOUTH) {
    this.direction = direction;
    this.isSloped = this.isDirectionSloped(direction);
    this.slopeDirection = this.isSloped ? direction : RailDirection.NORTH_SOUTH;
  }

  static isDirectionSloped(direction: RailDirection): boolean {
    return direction >= RailDirection.ASCENDING_EAST;
  }

  static getSlopeVector(direction: RailDirection): Vector3 {
    switch (direction) {
      case RailDirection.ASCENDING_EAST:
        return new Vector3(1, 0, 0);
      case RailDirection.ASCENDING_WEST:
        return new Vector3(-1, 0, 0);
      case RailDirection.ASCENDING_NORTH:
        return new Vector3(0, 0, -1);
      case RailDirection.ASCENDING_SOUTH:
        return new Vector3(0, 0, 1);
      default:
        return new Vector3(0, 0, 0);
    }
  }

  static getDirectionVector(direction: RailDirection): Vector3 {
    switch (direction) {
      case RailDirection.NORTH_SOUTH:
        return new Vector3(0, 0, 1);
      case RailDirection.EAST_WEST:
        return new Vector3(1, 0, 0);
      case RailDirection.ASCENDING_EAST:
        return new Vector3(1, 0, 0);
      case RailDirection.ASCENDING_WEST:
        return new Vector3(-1, 0, 0);
      case RailDirection.ASCENDING_NORTH:
        return new Vector3(0, 0, -1);
      case RailDirection.ASCENDING_SOUTH:
        return new Vector3(0, 0, 1);
      default:
        return new Vector3(0, 0, 0);
    }
  }
}
```

### 2. 마인카트 엔티티
```typescript
// MinecartEntity.ts
class MinecartEntity extends Entity {
  public velocity = new Vector3(0, 0, 0);
  public maxSpeed = 8.0;      // 최대 속도 8 m/s
  public friction = 0.98;     // 마찰력 (0.98 = 2% 감속)
  public gravity = 9.8;       // 중력 가속도
  public onRail = false;
  public railBlock: RailBlock | null = null;

  constructor(position: Vector3) {
    super(position);
    this.aabb = new AABB(0.9, 0.5, 1.4);  // 마인카트 크기 (낮음)
  }

  update(deltaTime: number): void {
    if (!this.onRail) {
      // 레일이 아니면 일반 물리
      this.updateNormalPhysics(deltaTime);
    } else {
      // 레일 물리
      this.updateRailPhysics(deltaTime);
    }
  }

  updateNormalPhysics(deltaTime: number): void {
    // 중력
    this.velocity.y -= this.gravity * deltaTime;

    // 이동
    const movement = this.velocity.clone().multiplyScalar(deltaTime);
    const nextPosition = this.position.clone().add(movement);

    // 충돌 검사
    const collision = this.world.checkCollision(this, nextPosition);

    if (collision.collided) {
      this.velocity.y = 0;
      this.velocity.x *= 0.5;  // 바닥에서 마찰
      this.velocity.z *= 0.5;
    } else {
      this.position = nextPosition;
    }
  }

  updateRailPhysics(deltaTime: number): void {
    if (!this.railBlock) {
      return;
    }

    const railDir = RailBlock.getDirectionVector(this.railBlock.direction);
    const currentSpeed = this.velocity.dot(railDir);

    // 경사 가속도
    if (this.railBlock.isSloped) {
      const slopeVec = RailBlock.getSlopeVector(this.railBlock.slopeDirection);
      const slopeForce = slopeVec.multiplyScalar(this.gravity * 0.5);  // 중력의 50%

      this.velocity.add(slopeForce.multiplyScalar(deltaTime));
    }

    // 마찰력 적용
    this.velocity.multiplyScalar(this.friction);

    // 최대 속도 제한
    if (currentSpeed > this.maxSpeed) {
      const speedRatio = this.maxSpeed / currentSpeed;
      this.velocity.multiplyScalar(speedRatio);
    }

    // 이동
    const movement = this.velocity.clone().multiplyScalar(deltaTime);
    const nextPosition = this.position.clone().add(movement);

    // 레일 감지
    const nextRail = this.findRailAt(nextPosition);

    if (nextRail) {
      // 다음 레일로 이동
      this.position = nextPosition;
      this.railBlock = nextRail;
      this.alignToRail(nextRail);
    } else {
      // 레일 끝: 일반 물리로 전환
      this.onRail = false;
      this.railBlock = null;
    }
  }

  alignToRail(rail: RailBlock): void {
    // 레일 방향에 정렬
    const railDir = RailBlock.getDirectionVector(rail.direction);

    // 수평 속도만 레일 방향으로
    this.velocity.x = railDir.x * Math.abs(this.velocity.x);
    this.velocity.z = railDir.z * Math.abs(this.velocity.z);

    // 경사면에서 높이 조정
    if (rail.isSloped) {
      this.position.y = Math.floor(this.position.y) + 0.5;
    }
  }

  findRailAt(position: Vector3): RailBlock | null {
    const bx = Math.floor(position.x);
    const by = Math.floor(position.y);
    const bz = Math.floor(position.z);

    // 현재 레일 검사
    const currentBlock = this.world.getBlock(bx, by, bz);

    if (currentBlock === BlockId.Rail) {
      return this.world.getBlockData(bx, by, bz) as RailBlock;
    }

    // 아래 레일 검사 (경사)
    const belowBlock = this.world.getBlock(bx, by - 1, bz);

    if (belowBlock === BlockId.Rail) {
      return this.world.getBlockData(bx, by - 1, bz) as RailBlock;
    }

    return null;
  }
}
```

### 3. 레일 경로 탐색
```typescript
// RailPathfinder.ts
class RailPathfinder {
  findNextRail(cart: MinecartEntity): RailBlock | null {
    const currentRail = cart.railBlock;

    if (!currentRail) {
      return null;
    }

    const railDir = RailBlock.getDirectionVector(currentRail.direction);
    const speed = cart.velocity.dot(railDir);

    // 속도 방향 확인
    const forward = speed > 0;

    // 인접 레일 탐색
    const nextPositions = this.getAdjacentRailPositions(
      cart.position,
      currentRail,
      forward
    );

    for (const nextPos of nextPositions) {
      const nextBlock = this.world.getBlock(
        nextPos.x,
        nextPos.y,
        nextPos.z
      );

      if (nextBlock === BlockId.Rail) {
        const nextRail = this.world.getBlockData(
          nextPos.x,
          nextPos.y,
          nextPos.z
        ) as RailBlock;

        return nextRail;
      }
    }

    return null;
  }

  getAdjacentRailPositions(
    position: Vector3,
    rail: RailBlock,
    forward: boolean
  ): Vector3[] {
    const positions: Vector3[] = [];
    const dir = RailBlock.getDirectionVector(rail.direction);

    // 기본 방향
    const baseX = Math.floor(position.x) + (forward ? dir.x : -dir.x);
    const baseZ = Math.floor(position.z) + (forward ? dir.z : -dir.z);
    const baseY = Math.floor(position.y);

    // 경사 처리
    if (rail.isSloped) {
      const slopeDir = RailBlock.getSlopeVector(rail.slopeDirection);

      if (forward) {
        // 경사 올라감
        positions.push(new Vector3(baseX, baseY + slopeDir.y, baseZ));
      } else {
        // 경사 내려감
        positions.push(new Vector3(baseX, baseY - slopeDir.y, baseZ));
      }
    } else {
      // 평면 레일
      positions.push(new Vector3(baseX, baseY, baseZ));

      // 인접 레일 확인 (커브 처리)
      const neighbors = [
        new Vector3(baseX + 1, baseY, baseZ),
        new Vector3(baseX - 1, baseY, baseZ),
        new Vector3(baseX, baseY, baseZ + 1),
        new Vector3(baseX, baseY, baseZ - 1)
      ];

      for (const neighbor of neighbors) {
        const block = this.world.getBlock(neighbor.x, neighbor.y, neighbor.z);

        if (block === BlockId.Rail) {
          positions.push(neighbor);
        }
      }
    }

    return positions;
  }
}
```

### 4. Player 탑승 (Horse Riding과 유사)
```typescript
// Player.ts
class Player extends Entity {
  public riding: RidingState = {
    isRiding: false,
    mount: null,
    mountOffset: new Vector3(0, 0.5, 0),
    mountAngle: 0
  };

  get mount(): Entity | null {
    return this.riding.mount;
  }

  attemptMount(entity: Entity): boolean {
    // 이미 탑승 중
    if (this.riding.isRiding) {
      return false;
    }

    // 마인카트만 탑승 가능
    if (!(entity instanceof MinecartEntity)) {
      return false;
    }

    // 탑승 성공
    this.riding.isRiding = true;
    this.riding.mount = entity;

    // 위치 동기화
    this.syncPositionToMount();

    // 카메라 업데이트
    this.view.updateForRiding(true, entity);

    return true;
  }

  dismount(): boolean {
    if (!this.riding.isRiding) {
      return false;
    }

    // 옆으로 이동
    const dismountOffset = new Vector3(1, 0, 0);  // 오른쪽
    const dismountPos = this.position.clone().add(dismountOffset);

    // 위치 유효성 확인
    if (this.world.isPassable(dismountPos)) {
      this.position = dismountPos;
    }

    // 탑승 해제
    this.riding.isRiding = false;
    this.riding.mount = null;

    // 카메라 복원
    this.view.updateForRiding(false, null);

    return true;
  }

  syncPositionToMount(): void {
    if (!this.riding.mount) {
      return;
    }

    const mount = this.riding.mount;
    const offset = this.riding.mountOffset;

    // 마인카트 위치 + 오프셋
    this.position = mount.position.clone().add(offset);
  }

  update(deltaTime: number): void {
    if (this.riding.isRiding && this.riding.mount) {
      // 탑승 중: 물리 스킵, 마인카트 물리 사용
      this.syncPositionToMount();
      this.riding.mount.update(deltaTime);
    } else {
      // 일반 상태
      super.update(deltaTime);
    }
  }

  // 키 입력 처리
  handleInput(input: Input): void {
    if (this.riding.isRiding && this.riding.mount instanceof MinecartEntity) {
      // 마인카트 추진
      if (input.forward) {
        const cart = this.riding.mount as MinecartEntity;
        const railDir = RailBlock.getDirectionVector(cart.railBlock.direction);
        const pushForce = railDir.multiplyScalar(0.1);  // 약한 추진력
        cart.velocity.add(pushForce);
      }

      if (input.backward) {
        const cart = this.riding.mount as MinecartEntity;
        const railDir = RailBlock.getDirectionVector(cart.railBlock.direction);
        const pushForce = railDir.multiplyScalar(-0.05);  // 더 약한 역추진
        cart.velocity.add(pushForce);
      }
    } else {
      // 일반 입력 처리
      super.handleInput(input);
    }
  }
}
```

### 5. 레일 물리
```typescript
// RailPhysics.ts
class RailPhysics {
  static applyFriction(cart: MinecartEntity, deltaTime: number): void {
    if (!cart.onRail) {
      return;
    }

    // 마찰력 적용
    cart.velocity.multiplyScalar(cart.friction);
  }

  static applyGravity(cart: MinecartEntity, deltaTime: number): void {
    if (!cart.onRail || !cart.railBlock) {
      return;
    }

    // 경사면에서 중력 가속도
    if (cart.railBlock.isSloped) {
      const slopeDir = RailBlock.getSlopeVector(cart.railBlock.slopeDirection);
      const slopeForce = slopeDir.multiplyScalar(cart.gravity * 0.5);  // 중력의 50%

      cart.velocity.add(slopeForce.multiplyScalar(deltaTime));
    }
  }

  static limitSpeed(cart: MinecartEntity): void {
    if (!cart.onRail) {
      return;
    }

    const speed = cart.velocity.length();

    if (speed > cart.maxSpeed) {
      const speedRatio = cart.maxSpeed / speed;
      cart.velocity.multiplyScalar(speedRatio);
    }
  }
}
```

### 6. 제작 레시피
```typescript
// Recipes.ts
const MINECART_RECIPES = [
  {
    result: { item: BlockId.Rail, count: 16 },  // 레일 16개
    pattern: [
      ['I', ' ', 'I'],
      ['I', 'S', 'I'],
      ['I', ' ', 'I']
    ],
    ingredients: {
      'I': { item: BlockId.IronIngot },
      'S': { item: BlockId.Stick }
    }
  },
  {
    result: { item: BlockId.Minecart, count: 1 },  // 마인카트 1개
    pattern: [
      ['I', ' ', 'I'],
      ['I', 'I', 'I']
    ],
    ingredients: {
      'I': { item: BlockId.IronIngot }
    }
  }
];
```

## 충돌/의존성

### 충돌 포인트
- **Player**: 탑승/하차 로직 추가 (Horse Riding과 유사)
- **Entity**: MinecartEntity 추가
- **Block**: 레일 블록 ID 추가
- **Physics**: 레일 물리 (가속/감속)
- **World**: 레일 감지, 경로 탐색

### 의존성
- `Entity`: MinecartEntity 상속
- `Block`: RailBlock
- `World`: 레일 탐색
- `THREE`: 마인카트 모델

## 테스트 방법

### 단위 테스트
1. **레일 방향**: 방향별 벡터 계산 검증
2. **경사 가속도**: 경사면에서 속도 증가 확인
3. **마찰력**: 시간 경과에 따른 속도 감소 확인
4. **최대 속도**: 속도 제한 동작 확인

### 통합 테스트
1. **레일 배치**: 레일 설치 및 방향 확인
2. **마인카트 스폰**: 마인카트 생성 및 레일 감지
3. **탑승**: 마인카트 탑승 및 위치 동기화
4. **이동**: 레일 위 이동, 경사 가속
5. **하차**: 마인카트에서 하차 및 플레이어 위치
6. **제작**: 레일/마인카트 제작 레시피

### 엣지 케이스
- 레일 끝에서 떨어질 때 처리
- 여러 레일이 연결될 때 커브 처리
- 경사와 평면 레일이 만날 때 속도 유지
- 마인카트가 뒤집힐 때 처리
- 청크 로드 시 마인카트 상태 유지
- 마인카트가 물에 빠졌을 때
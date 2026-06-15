# 27. 활과 화살 시스템 (Bow and Arrow)

## 개요
활 아이템으로 우클릭 유지 시 차지, 떼면 화살을 발사하는 시스템을 구현한다. 차지 시간에 비례하여 화살 속도와 데미지가 증가하며, 화살은 포물선 궤적을 그리며 이동한다.

## 구현 범위
- 활 아이템(280): 우클릭 차지, 발사 로직
- 차지 시간에 비례한 화살 속도 (5~25 m/s)와 데미지 (2~8)
- ArrowEntity: 포물선 궤적, 충돌 처리, 블록에 박힘
- 화살 아이템(281): 소모성, Stack 가능
- 레시피: Stick 3 + String (활), Stick + Flint + Feather (화살)

## 수정 대상 파일
- `src/entities/Player.ts`: 활 발사 로직, 차지 상태 관리
- `src/entities/Entity.ts`: ArrowEntity 추가
- `src/combat/Combat.ts`: 화살 데미지 계산
- `src/items/BowItem.ts`: 활 아이템 클래스
- `src/crafting/Recipes.ts`: 활/화살 레시피 등록
- `src/data/Block.ts`: 활/화살 아이템 ID 추가

## 추가 파일
- `src/entities/ArrowEntity.ts`: 화살 엔티티
- `src/items/ArrowItem.ts`: 화살 아이템
- `src/projectiles/ProjectilePhysics.ts`: 포물선 궤적 물리

## 데이터 구조
```typescript
// 활 아이템
interface BowItem {
  id: number;
  maxDrawTime: number;      // 최대 차지 시간 (초)
  minCharge: number;        // 최소 차지율 (0.2 = 20%)
  durability: number;
  maxDurability: number;
}

// 화살 엔티티
interface ArrowEntity extends Entity {
  owner: Entity;            // 발사자
  velocity: Vector3;
  gravity: Vector3;
  damage: number;
  isStuck: boolean;         // 블록/엔티티에 박혔는지
  stuckPosition: Vector3;   // 박힌 위치
  stuckNormal: Vector3;     // 박힌 표면 법선
}

// 화살 아이템
interface ArrowItem {
  id: number;
  stackable: true;
  maxStackSize: 64;
  damageBonus: number;      // 화살 추가 데미지
}

// 발사 상태
interface BowChargeState {
  isCharging: boolean;
  chargeStartTime: number;
  chargePercent: number;
}
```

## 핵심 로직

### 1. 활 아이템 정의
```typescript
// BowItem.ts
const BOW_ITEM: BowItem = {
  id: 280,
  maxDrawTime: 2.0,      // 2초 최대 차지
  minCharge: 0.2,        // 최소 20% 차지 필요
  durability: 384,
  maxDurability: 384
};

function createBowItem(): BowItem {
  return { ...BOW_ITEM };
}

function getBowDamage(chargePercent: number): number {
  // 차지율 0.2~1.0 → 데미지 2~8
  const percent = Math.max(0.2, Math.min(1.0, chargePercent));
  return 2 + (percent - 0.2) * (8 - 2) / (1.0 - 0.2);
}

function getBowVelocity(chargePercent: number): number {
  // 차지율 0.2~1.0 → 속도 5~25 m/s
  const percent = Math.max(0.2, Math.min(1.0, chargePercent));
  return 5 + (percent - 0.2) * (25 - 5) / (1.0 - 0.2);
}
```

### 2. Player 활 차지 및 발사
```typescript
// Player.ts
class Player extends Entity {
  private bowChargeState: BowChargeState = {
    isCharging: false,
    chargeStartTime: 0,
    chargePercent: 0
  };

  startBowCharge(): void {
    const heldItem = this.inventory.getSelectedItem();

    if (heldItem && heldItem.id === 280 && !this.bowChargeState.isCharging) {
      // 화살 확인
      if (this.inventory.hasItem(281)) {
        this.bowChargeState.isCharging = true;
        this.bowChargeState.chargeStartTime = performance.now();
        this.bowChargeState.chargePercent = 0;
      }
    }
  }

  releaseBow(): void {
    if (!this.bowChargeState.isCharging) {
      return;
    }

    const chargeTime = (performance.now() - this.bowChargeState.chargeStartTime) / 1000;
    const chargePercent = Math.min(1.0, chargeTime / BOW_ITEM.maxDrawTime);

    // 최소 차지 확인
    if (chargePercent >= BOW_ITEM.minCharge) {
      this.fireArrow(chargePercent);
    }

    // 상태 초기화
    this.bowChargeState.isCharging = false;
    this.bowChargeState.chargePercent = 0;
  }

  updateBowCharge(deltaTime: number): void {
    if (this.bowChargeState.isCharging) {
      const chargeTime = (performance.now() - this.bowChargeState.chargeStartTime) / 1000;
      this.bowChargeState.chargePercent = Math.min(1.0, chargeTime / BOW_ITEM.maxDrawTime);
    }
  }

  fireArrow(chargePercent: number): void {
    // 화살 소모
    const arrowStack = this.inventory.findItem(281);
    if (!arrowStack) {
      return;  // 화살 없음
    }

    arrowStack.count--;
    if (arrowStack.count <= 0) {
      this.inventory.removeItem(arrowStack);
    }

    // 발사 방향 (플레이어 시야 방향)
    const direction = this.getViewDirection();
    const speed = getBowVelocity(chargePercent);
    const damage = getBowDamage(chargePercent);

    // 화살 엔티티 생성
    const arrow = new ArrowEntity({
      position: this.position.clone().add(new Vector3(0, 1.5, 0)),
      velocity: direction.multiplyScalar(speed),
      owner: this,
      damage: damage
    });

    this.world.addEntity(arrow);

    // 활 내구성 감소
    const heldItem = this.inventory.getSelectedItem();
    if (heldItem) {
      heldItem.durability--;
      if (heldItem.durability <= 0) {
        this.inventory.removeItem(heldItem);
      }
    }
  }
}
```

### 3. ArrowEntity 구현
```typescript
// ArrowEntity.ts
class ArrowEntity extends Entity {
  public owner: Entity;
  public velocity: Vector3;
  public gravity = new Vector3(0, -9.8, 0);  // 중력 가속도
  public damage: number;
  public isStuck = false;
  public stuckPosition: Vector3;
  public stuckNormal: Vector3;

  constructor(config: {
    position: Vector3;
    velocity: Vector3;
    owner: Entity;
    damage: number;
  }) {
    super(config.position);
    this.velocity = config.velocity;
    this.owner = config.owner;
    this.damage = config.damage;
    this.aabb = new AABB(0.1, 0.1, 0.1);  // 작은 충돌 박스
  }

  update(deltaTime: number): void {
    if (this.isStuck) {
      return;  // 박혀있으면 업데이트 중단
    }

    // 중력 적용
    this.velocity.add(this.gravity.clone().multiplyScalar(deltaTime));

    // 이동
    const movement = this.velocity.clone().multiplyScalar(deltaTime);
    const nextPosition = this.position.clone().add(movement);

    // 충돌 검사
    const collision = this.checkCollision(nextPosition);

    if (collision.collided) {
      // 박히기 처리
      this.isStuck = true;
      this.stuckPosition = collision.position;
      this.stuckNormal = collision.normal;
      this.position = this.stuckPosition;

      // 소멸 타이머 (60초 후 제거)
      setTimeout(() => {
        this.world.removeEntity(this);
      }, 60000);

      return;
    }

    // 엔티티 충돌 검사
    const entityCollision = this.checkEntityCollision(nextPosition);

    if (entityCollision) {
      // 엔티티에 데미지 적용
      entityCollision.takeDamage(this.damage, { source: 'arrow', attacker: this.owner });

      // 화살 제거
      this.world.removeEntity(this);
      return;
    }

    // 위치 업데이트
    this.position = nextPosition;
  }

  checkCollision(position: Vector3): CollisionResult {
    // 블록 충돌 검사
    const minX = Math.floor(position.x - 0.05);
    const maxX = Math.floor(position.x + 0.05);
    const minY = Math.floor(position.y - 0.05);
    const maxY = Math.floor(position.y + 0.05);
    const minZ = Math.floor(position.z - 0.05);
    const maxZ = Math.floor(position.z + 0.05);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.world.getBlock(x, y, z);

          if (block !== BlockId.Air && block !== BlockId.Water) {
            // 충돌 계산
            const blockCenter = new Vector3(x + 0.5, y + 0.5, z + 0.5);
            const normal = position.clone().sub(blockCenter).normalize();

            return {
              collided: true,
              position: blockCenter,
              normal: normal
            };
          }
        }
      }
    }

    return { collided: false };
  }

  checkEntityCollision(position: Vector3): Entity | null {
    // 엔티티 충돌 검사
    for (const entity of this.world.entities) {
      if (entity === this.owner) {
        continue;  // 발사자 제외
      }

      const distance = position.distanceTo(entity.position);

      if (distance < entity.aabb.radius) {
        return entity;
      }
    }

    return null;
  }
}
```

### 4. 화살 아이템 정의
```typescript
// ArrowItem.ts
const ARROW_ITEM: ArrowItem = {
  id: 281,
  stackable: true,
  maxStackSize: 64,
  damageBonus: 0  // 기본 화살은 추가 데미지 없음
};

function createArrowItem(count: number = 1): ItemStack {
  return {
    item: { ...ARROW_ITEM },
    count: Math.min(count, ARROW_ITEM.maxStackSize)
  };
}
```

### 5. 제작 레시피
```typescript
// Recipes.ts
const BOW_ARROW_RECIPES = [
  {
    result: { item: 280, count: 1 },  // 활
    pattern: [
      ['S', ' ', 'S'],
      ['S', 'T', 'S'],
      [' ', 'S', ' ']
    ],
    ingredients: {
      'S': { item: BlockId.Stick },
      'T': { item: BlockId.String }
    }
  },
  {
    result: { item: 281, count: 4 },  // 화살 4개
    pattern: [
      ['F', ' ', ' '],
      ['S', ' ', ' '],
      ['F', ' ', ' ']
    ],
    ingredients: {
      'F': { item: BlockId.Flint },
      'S': { item: BlockId.Stick },
      'F': { item: BlockId.Feather }
    }
  }
];
```

## 충돌/의존성

### 충돌 포인트
- **Player**: 활 차지/발사 로직 추가
- **Entity**: ArrowEntity로 확장, 충돌 시스템 확장
- **Combat**: 화살 데미지 적용

### 의존성
- `Inventory`: 화살 소모, 스택 관리
- `World`: 화살 엔티티 추가/제거
- `Physics`: 포물선 궤적 계산

## 테스트 방법

### 단위 테스트
1. **차지 계산**: 차지 시간별 속도/데미지 계산 검증
2. **포물선 궤적**: 중력 적용, 궤적 계산 확인
3. **충돌**: 블록/엔티티 충돌 감지 정확도

### 통합 테스트
1. **활 발사**: 차지, 발사, 궤적 테스트
2. **화살 소모**: 인벤토리에서 화살 소모 확인
3. **엔티티 타격**: 몹에 맞았을 때 데미지 적용
4. **내구성**: 활 사용 시 내구성 감소
5. **박힘**: 화살이 블록에 박혀 남아있는지

### 엣지 케이스
- 최소 차지 미만일 때 발사 안됨
- 화살이 없을 때 발사 안됨
- 화살이 벽을 뚫지 않음
- 발사자 본인에 맞지 않음
- 물에 빠질 때 물리 적용
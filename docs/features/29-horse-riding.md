# 29. 말 탑승 시스템 (Horse Riding)

## 개요
플레이어가 말 엔티티에 탑승하여 이동할 수 있는 시스템을 구현한다. 말은 길들이기 과정을 거쳐야 탑승 가능하며, 탑승 시 카메라가 말 뒤로 이동하고 이동 속도가 증가한다.

## 구현 범위
- 말 Entity: Animal 상속, 길들이기(탑승 시도 3회 후 성공)
- 탑승 시 player.position = horse.position + offset, 카메라가 말 뒤로
- 이동 속도: 말 기본 8 m/s (플레이어 5.5), 대시 14 m/s
- Player에 riding: Entity | null 추가, Physics에서 탑승 시 플레이어 물리 스킵
- PlayerView에서 탑승 자세 (다리 구부림)

## 수정 대상 파일
- `src/entities/Player.ts`: riding 추가, 탑승/하차 로직
- `src/entities/Entity.ts`: Animal 상속, HorseEntity 추가
- `src/physics/Physics.ts`: 탑승 시 물리 스킵
- `src/view/PlayerView.ts`: 탑승 자세 모델
- `src/world/World.ts`: 말 스폰 로직

## 추가 파일
- `src/entities/HorseEntity.ts`: 말 엔티티
- `src/entities/Animal.ts`: 동물 기반 클래스
- `src/riding/RidingSystem.ts`: 탑승 시스템
- `src/view/HorseView.ts`: 말 시각화

## 데이터 구조
```typescript
// 동물 기반
interface Animal extends Entity {
  tamed: boolean;          // 길들여졌는지
  tameProgress: number;    // 길들이기 진행 (0-100)
  owner: Entity | null;    // 소유자
}

// 말 엔티티
interface HorseEntity extends Animal {
  variant: HorseVariant;   // 말 색상 변종
  speed: number;           // 이동 속도
  dashSpeed: number;       // 대시 속도
  jumpPower: number;       // 점프력
  maxHealth: number;       // 최대 체력
}

// 말 변종
enum HorseVariant {
  White = 0,
  Brown = 1,
  Black = 2,
  Gray = 3,
  Cream = 4
}

// 탑승 상태
interface RidingState {
  isRiding: boolean;
  mount: Entity | null;     // 탑승 중인 엔티티
  mountOffset: Vector3;    // 엔티티 내 플레이어 위치
  mountAngle: number;      // 엔티티 내 플레이어 회전
}

// 플레이어 확장
interface Player extends Entity {
  riding: RidingState;
  mount: Entity | null;    // 탑승 중인 엔티티 (단축 접근)
}
```

## 핵심 로직

### 1. Animal 기반 클래스
```typescript
// Animal.ts
class Animal extends Entity {
  public tamed = false;
  public tameProgress = 0;
  public owner: Entity | null = null;

  constructor(position: Vector3) {
    super(position);
    this.aabb = new AABB(0.9, 1.8, 0.9);  // 동물 크기
  }

  tame(attempter: Entity): boolean {
    if (this.tamed) {
      return false;  // 이미 길들임
    }

    // 길들이기 성공 확률 (진행도에 따라 증가)
    const successChance = this.tameProgress / 100;

    if (Math.random() < successChance) {
      this.tamed = true;
      this.owner = attempter;
      this.tameProgress = 100;
      return true;
    } else {
      this.tameProgress = Math.min(100, this.tameProgress + 25);
      return false;
    }
  }
}
```

### 2. HorseEntity 구현
```typescript
// HorseEntity.ts
class HorseEntity extends Animal {
  public variant: HorseVariant;
  public speed = 8.0;        // 기본 8 m/s
  public dashSpeed = 14.0;   // 대시 14 m/s
  public jumpPower = 1.5;    // 점프력
  public maxHealth = 20;     // 최대 체력

  private isDashing = false;
  private dashCooldown = 0;
  private dashCooldownTime = 2.0;  // 2초 쿨다운

  constructor(position: Vector3, variant: HorseVariant) {
    super(position);
    this.variant = variant;
    this.aabb = new AABB(1.4, 1.6, 2.2);  // 말 크기 (길쭉함)
  }

  update(deltaTime: number): void {
    super.update(deltaTime);

    // 대시 쿨다운 업데이트
    if (this.dashCooldown > 0) {
      this.dashCooldown -= deltaTime;
    }
  }

  dash(): boolean {
    if (this.dashCooldown > 0) {
      return false;  // 쿨다운 중
    }

    this.isDashing = true;
    this.dashCooldown = this.dashCooldownTime;

    // 1초 후 대시 종료
    setTimeout(() => {
      this.isDashing = false;
    }, 1000);

    return true;
  }

  getCurrentSpeed(): number {
    return this.isDashing ? this.dashSpeed : this.speed;
  }

  jump(): void {
    if (this.onGround) {
      this.velocity.y = this.jumpPower;
      this.onGround = false;
    }
  }
}
```

### 3. Player 탑승 시스템
```typescript
// Player.ts
class Player extends Entity {
  public riding: RidingState = {
    isRiding: false,
    mount: null,
    mountOffset: new Vector3(0, 0.8, 0),
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

    // 동물만 탑승 가능
    if (!(entity instanceof Animal)) {
      return false;
    }

    // 길들여지지 않으면 길들이기 시도
    if (!entity.tamed) {
      const tamed = entity.tame(this);

      if (!tamed) {
        // 길들이기 실패 메시지
        this.showMessage("말이 아직 길들여지지 않았습니다.");
        return false;
      }
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

    // 말 뒤로 이동
    const dismountOffset = this.getViewDirection().clone().multiplyScalar(-2);
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

    // 말 위치 + 오프셋
    this.position = mount.position.clone().add(offset);
  }

  update(deltaTime: number): void {
    if (this.riding.isRiding && this.riding.mount) {
      // 탑승 중: 물리 스킵, 말 물리 사용
      this.syncPositionToMount();
      this.riding.mount.update(deltaTime);
    } else {
      // 일반 상태
      super.update(deltaTime);
    }
  }
}
```

### 4. Physics 탑승 처리
```typescript
// Physics.ts
function updateEntityPhysics(entity: Entity, deltaTime: number): void {
  // 탑승 중인 플레이어는 물리 스킵
  if (entity instanceof Player && entity.riding.isRiding) {
    return;
  }

  // 일반 물리 처리
  const gravity = new Vector3(0, -9.8, 0);
  entity.velocity.add(gravity.clone().multiplyScalar(deltaTime));

  // 이동
  const movement = entity.velocity.clone().multiplyScalar(deltaTime);
  const nextPosition = entity.position.clone().add(movement);

  // 충돌 검사 및 처리
  const collision = checkCollision(entity, nextPosition);

  if (collision.collided) {
    // 충돌 시 반응
    handleCollision(entity, collision);
  } else {
    entity.position = nextPosition;
  }
}
```

### 5. PlayerView 탑승 자세
```typescript
// PlayerView.ts
class PlayerView {
  private ridingModel: THREE.Group;
  private legBones: Map<string, THREE.Bone>;

  constructor() {
    this.legBones = new Map();
    this.setupLegBones();
  }

  setupLegBones(): void {
    // 다리 본 로드 (모델에서 가져옴)
    this.legBones.set('leftLeg', this.model.getBoneByName('LeftLeg'));
    this.legBones.set('rightLeg', this.model.getBoneByName('RightLeg'));
  }

  updateForRiding(isRiding: boolean, mount: Entity | null): void {
    if (isRiding && mount) {
      // 탑승 자세: 다리 구부림
      this.applyRidingPose();
    } else {
      // 일반 자세 복원
      this.applyStandingPose();
    }
  }

  applyRidingPose(): void {
    // 무릎 굽힘 (45도)
    const leftLeg = this.legBones.get('leftLeg');
    const rightLeg = this.legBones.get('rightLeg');

    if (leftLeg) {
      leftLeg.rotation.x = Math.PI / 4;  // 45도
    }

    if (rightLeg) {
      rightLeg.rotation.x = Math.PI / 4;
    }

    // 상체 약간 앞으로
    this.model.rotation.x = 0.1;
  }

  applyStandingPose(): void {
    // 다리 복원
    const leftLeg = this.legBones.get('leftLeg');
    const rightLeg = this.legBones.get('rightLeg');

    if (leftLeg) {
      leftLeg.rotation.x = 0;
    }

    if (rightLeg) {
      rightLeg.rotation.x = 0;
    }

    // 상체 복원
    this.model.rotation.x = 0;
  }

  updateCamera(isRiding: boolean, mount: Entity | null): void {
    if (isRiding && mount) {
      // 카메라가 말 뒤로
      const mountPos = mount.position;
      const cameraOffset = new Vector3(0, 2, -4);  // 말 뒤 4칸

      this.camera.position.copy(mountPos).add(cameraOffset);
      this.camera.lookAt(mountPos);
    } else {
      // 일반 카메라 (플레이어 뒤)
      const playerPos = this.player.position;
      const cameraOffset = new Vector3(0, 1.6, -3);  // 플레이어 뒤 3칸

      this.camera.position.copy(playerPos).add(cameraOffset);
      this.camera.lookAt(playerPos);
    }
  }
}
```

### 6. 말 스폰 로직
```typescript
// World.ts
class World {
  spawnHorses(): void {
    // 각 바이옴별 스폰 확률
    const spawnRates = {
      [BiomeId.Plains]: 0.02,    // 2%
      [BiomeId.Forest]: 0.01,    // 1%
      [BiomeId.Desert]: 0.005,   // 0.5%
      [BiomeId.Volcano]: 0.0     // 0%
    };

    // 청크별 스폰
    for (const chunk of this.chunks) {
      const biome = chunk.getBiome();
      const spawnRate = spawnRates[biome] || 0;

      if (Math.random() < spawnRate) {
        this.spawnHorseInChunk(chunk);
      }
    }
  }

  spawnHorseInChunk(chunk: Chunk): void {
    // 랜덤 위치
    const x = chunk.x * 16 + Math.random() * 16;
    const z = chunk.z * 16 + Math.random() * 16;

    // 지상 높이 찾기
    const y = this.findGroundHeight(x, z);

    // 말 생성
    const variant = Math.floor(Math.random() * 5);  // 0-4 변종
    const horse = new HorseEntity(
      new Vector3(x, y, z),
      variant as HorseVariant
    );

    this.addEntity(horse);
  }

  findGroundHeight(x: number, z: number): number {
    // 위에서부터 첫 번째 고체 블록 찾기
    for (let y = 63; y >= 0; y--) {
      const block = this.getBlock(x, y, z);

      if (block !== BlockId.Air && block !== BlockId.Water && block !== BlockId.Lava) {
        return y + 1;  // 블록 위
      }
    }

    return 20;  // 기본 높이
  }
}
```

## 충돌/의존성

### 충돌 포인트
- **Player**: 탑승/하차 로직 추가, 물리 스킵
- **Entity**: Animal 상속, HorseEntity 추가
- **Physics**: 탑승 시 물리 스킵
- **PlayerView**: 탑승 자세, 카메라 업데이트

### 의존성
- `Entity`: Animal 상속
- `World`: 말 스폰
- `THREE`: 모델, 본 애니메이션

## 테스트 방법

### 단위 테스트
1. **길들이기**: 시도 횟수별 성공 확률 검증
2. **말 속도**: 기본/대시 속도 확인
3. **위치 동기화**: 플레이어와 말 위치 일치 확인

### 통합 테스트
1. **탑승**: 말 근처에서 탑승 시도
2. **이동**: 탑승 상태에서 이동 속도 확인
3. **하차**: 말에서 하차 시 플레이어 위치 확인
4. **대시**: Shift 키로 대시 테스트
5. **점프**: 말 점프력 확인
6. **UI**: 탑승 자세, 카메라 위치 확인

### 엣지 케이스
- 탑승 중 말이 죽을 때 처리
- 청크 로드 시 말 상태 유지
- 말이 높은 곳에서 떨어질 때
- 여러 플레이어가 같은 말에 탑승 시도
- 말이 물에 빠졌을 때 탑승 상태
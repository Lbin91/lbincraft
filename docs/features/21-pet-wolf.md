# 애완 늑대 (Pet Wolf) 기능 설계

## 개요
플레이어가 길들일 수 있는 애완 늑대 Entity를 구현합니다. 길들이기 전에는 중립/도망 상태이며, 뼈다귀 아이템을 주면 길들여진 상태로 전환됩니다. 길들여진 늑대는 플레이어를 따라다니며, 좀비 공격 시 전투 어시스트를 제공합니다. Entity에 tamedBy 속성이 추가됩니다.

## 구현 범위
- 늑대 Entity (Animal 상속)
- 뼈다귀 아이템 (Bone=270)
- 길들기 시스템 (중립/도망 → 길들어짐)
- 길들여진 늑대 AI (플레이어 추적)
- 전투 어시스트 (좀비 공격)
- 늑대 모델 및 애니메이션

## 수정 대상 파일
- `Entity.ts`: Animal 클래스, tamedBy 속성 추가
- `BlockId.ts`: Bone=270 추가
- `EntityManager.ts`: 늑대 스폰, 길들기 로직
- `Game.ts`: 늑대 AI 업데이트, 전투 로직
- `MeshBuilder.ts`: 늑대 메시 생성 (또는 별도 모델 파일)

## 추가 파일
- `Wolf.ts`: 늑대 Entity 클래스
  ```typescript
  class Wolf extends Animal {
    tamedBy: number | null = null; // 플레이어 ID
    state: 'neutral' | 'fleeing' | 'tamed';
    owner: Entity | null = null;

    constructor(x, y, z) {
      super(x, y, z);
      this.state = 'neutral';
    }

    tame(playerId: number): void {
      this.tamedBy = playerId;
      this.state = 'tamed';
      this.owner = entityManager.getEntity(playerId);
    }

    update(deltaTime: number, world): void {
      if (this.state === 'tamed') {
        this.followOwner();
      } else {
        this.wanderOrFlee(world);
      }
    }
  }
  ```

## 데이터 구조
- `Entity.tamedBy`: number | null - 길들인 플레이어 ID
- `Entity.state`: 'neutral' | 'fleeing' | 'tamed'
```typescript
// 의사 코드
abstract class Animal extends Entity {
  health: number = 20;
  speed: number = 1;
}

class Wolf extends Animal {
  tamedBy: number | null = null;
  state: 'neutral' | 'fleeing' | 'tamed' = 'neutral';
  owner: Entity | null = null;

  tame(playerId: number): void {
    this.tamedBy = playerId;
    this.state = 'tamed';
    this.owner = entityManager.getEntity(playerId);
  }

  update(deltaTime: number, world): void {
    if (this.state === 'tamed') {
      this.followOwner();
    } else {
      this.wanderOrFlee(world);
    }

    super.update(deltaTime, world);
  }

  followOwner(): void {
    if (!this.owner) return;

    const distance = this.position.distanceTo(this.owner.position);

    if (distance > 5) {
      const direction = this.owner.position.clone().sub(this.position).normalize();
      this.velocity.x = direction.x * this.speed;
      this.velocity.z = direction.z * this.speed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  wanderOrFlee(world): void {
    // 주변 10블록 내 플레이어 탐지
    const nearbyPlayer = world.findNearbyPlayer(this.position, 10);

    if (nearbyPlayer) {
      this.state = 'fleeing';

      // 도망 방향
      const direction = this.position.clone().sub(nearbyPlayer.position).normalize();
      this.velocity.x = direction.x * (this.speed * 1.5);
      this.velocity.z = direction.z * (this.speed * 1.5);
    } else {
      this.state = 'neutral';
      this.wander();
    }
  }

  wander(): void {
    // 랜덤 방향으로 2-5초 동안 이동
    if (Math.random() < 0.01) {
      this.wanderDirection = new Vector3(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
      ).normalize();
    }

    if (this.wanderDirection) {
      this.velocity.x = this.wanderDirection.x * (this.speed * 0.5);
      this.velocity.z = this.wanderDirection.z * (this.speed * 0.5);
    }
  }

  attack(target: Entity): void {
    target.health -= 5; // 늑대 데미지
    world.spawnParticles(target.position, 'BLOOD');
  }
}
```

## 핵심 로직
1. 늑대 스폰:
```typescript
function spawnWolf(entityManager, world, x, y, z): void {
  const wolf = new Wolf(x, y, z);
  entityManager.addEntity(wolf);
  world.modificationMap.set(`${x},${y},${z}`, {
    entityId: wolf.id,
    entityType: 'wolf',
  });
}
```

2. 뼈다귀 사용 (길들이기):
```typescript
function onBoneUse(player, entityManager, world): void {
  const target = getEntityUnderCrosshair(player, entityManager);

  if (target instanceof Wolf && target.tamedBy === null) {
    // 30% 확률로 길들기 성공
    if (Math.random() < 0.3) {
      target.tame(player.id);
      world.uiManager.showMessage("늑대가 길들여졌습니다!");
    } else {
      world.uiManager.showMessage("늑대가 아직 길들여지지 않았습니다.");
    }

    // 아이템 소비
    player.inventory.consumeItem(player.heldSlot, 1);
  }
}
```

3. 늑대 AI 업데이트:
```typescript
function updateWolves(entityManager, world, deltaTime: number): void {
  const wolves = entityManager.getEntitiesByType(Wolf);

  for (const wolf of wolves) {
    wolf.update(deltaTime, world);

    // 전투 어시스트
    if (wolf.state === 'tamed') {
      assistInCombat(wolf, world);
    }
  }
}

function assistInCombat(wolf, world): void {
  if (!wolf.owner) return;

  // 주변 10블록 내 좀비 탐지
  const nearbyZombies = world.findNearbyEntitiesByType(wolf.owner.position, 10, 'Zombie');

  for (const zombie of nearbyZombies) {
    const distance = wolf.position.distanceTo(zombie.position);

    if (distance <= 2) {
      wolf.attack(zombie);
    } else {
      // 좀비 추격
      const direction = zombie.position.clone().sub(wolf.position).normalize();
      wolf.velocity.x = direction.x * (wolf.speed * 1.2);
      wolf.velocity.z = direction.z * (wolf.speed * 1.2);
    }
  }
}
```

4. 늑대 메시 생성:
```typescript
function buildWolfMesh(): Mesh {
  const group = new Group();

  // 몸통
  const body = new BoxGeometry(0.8, 0.6, 1.2);
  const bodyMesh = new Mesh(body, new MeshLambertMaterial({ color: 0x808080 }));
  group.add(bodyMesh);

  // 머리
  const head = new BoxGeometry(0.5, 0.5, 0.6);
  const headMesh = new Mesh(head, new MeshLambertMaterial({ color: 0x909090 }));
  headMesh.position.set(0, 0.3, 0.8);
  group.add(headMesh);

  // 다리
  for (let i = 0; i < 4; i++) {
    const leg = new BoxGeometry(0.2, 0.5, 0.2);
    const legMesh = new Mesh(leg, new MeshLambertMaterial({ color: 0x808080 }));
    const x = (i % 2 === 0 ? -1 : 1) * 0.25;
    const z = (i < 2 ? -1 : 1) * 0.4;
    legMesh.position.set(x, -0.5, z);
    group.add(legMesh);
  }

  return group;
}
```

## 충돌/의존성
- EntityManager와 Entity 시스템 의존
- 좀비 Entity와의 전투 연동
- 플레이어 Entity와의 길들기 연동
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 늑대 스폰 테스트: 늑대가 올바르게 스폰되는지 확인
2. 길들기 테스트: 뼈다귀 사용 시 길들여지는지 확인
3. 추적 테스트: 길들여진 늑대가 플레이어를 따라오는지 확인
4. 도망 테스트: 길들여지지 않은 늑대가 도망가는지 확인
5. 전투 어시스트 테스트: 좀비 공격 시 늑대가 어시스트하는지 확인
6. 저장/로드 테스트: 길들여진 늑대 상태가 올바르게 저장되는지 확인
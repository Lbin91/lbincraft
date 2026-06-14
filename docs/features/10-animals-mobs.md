# Feature 10: Animals / Mobs

> 난이도: ⭐⭐⭐ Large | 예상 시간: 6시간

## 개열

세계에 돌아다니는 동물(돼지, 닭, 소)과 적대적 몹(좀비)을 추가. 엔티티 시스템, 간단한 AI, 애니메이션을 구현하여 세계가 살아있는 느낌을 줌.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 초원을 걷다 보면 | 돼지, 닭, 소가 무리지어 있음 |
| S2 | 동물은 | 랜덤하게 돌아다님 (wandering AI) |
| S3 | 플레이어가 가까이 가면 | 동물이 도망감 (flee behavior) |
| S4 | 동물을 공격하면 | 데미지 → 사망 → 고기 드롭 |
| S5 | 밤이 되면 | 좀비가 스폰되어 플레이어를 쫓아옴 |
| S6 | 좀비에게 잡히면 | 플레이어 데미지 (Feature 09 연동) |
| S7 | 좀비는 | 해가 뜨면 불타서 사라짐 |

## 기술 설계

### 신규 파일
- `src/entities/Entity.ts` — 엔티티 기본 클래스 (위치, 속도, AABB, 체력)
- `src/entities/EntityManager.ts` — 엔티티 스폰/업데이트/제거 관리
- `src/entities/Animal.ts` — 동물 기본 클래스 (wandering, flee AI)
- `src/entities/Pig.ts` — 돼지 (고기 드롭)
- `src/entities/Chicken.ts` — 닭 (알, 낮은 점프)
- `src/entities/Zombie.ts` — 좀비 (추적 AI, 밤 스폰)
- `src/entities/EntityMeshBuilder.ts` — 박스 기반 엔티티 메시 생성

### 수정 파일
- `src/engine/Game.ts` — EntityManager 통합, 스폰 로직
- `src/engine/DayNightCycle.ts` (Feature 03) — 밤 좀비 스폰 트리거
- `src/player/Survival.ts` (Feature 09) — 몹 공격 데미지
- `src/player/Physics.ts` — **범용화: `moveEntity(entity, width, height, world)` 정적 메서드 추가** (★ Oracle 검토 반영)

### 데이터 구조

```typescript
// Entity.ts
abstract class Entity {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: number;  // yaw
    health: number;
    maxHealth: number;
    mesh: THREE.Group;   // 박스 파트들 (몸, 머리, 다리)
    aabb: THREE.Box3;
    dead: boolean = false;

    abstract update(delta: number, world: World, player: Player): void;
    abstract takeDamage(amount: number): void;
    abstract getDrops(): BlockId[];

    protected buildMesh(): THREE.Group;
    protected updatePhysics(delta: number, world: World): void;  // 중력 + 충돌
}

// Animal.ts (돼지, 닭, 소의 기반)
abstract class Animal extends Entity {
    protected wanderTimer: number = 0;
    protected wanderDir: THREE.Vector3 = new THREE.Vector3();
    protected fleeTimer: number = 0;

    update(delta, world, player):
        // 1. 플레이어가 가까우면 도망
        const distToPlayer = this.position.distanceTo(player.position);
        if (distToPlayer < 5):
            fleeDir = (this.position - player.position).normalize()
            this.velocity.x = fleeDir.x * 3
            this.velocity.z = fleeDir.z * 3
            this.fleeTimer = 2.0
        // 2. 도망 중이면 계속
        elif fleeTimer > 0:
            fleeTimer -= delta
        // 3. 아니면 wandering
        else:
            wanderTimer -= delta
            if wanderTimer <= 0:
                wanderTimer = 3 + random() * 3  // 3~6초마다 방향 변경
                if random() < 0.5:
                    wanderDir.set(random()-0.5, 0, random()-0.5).normalize()
                else:
                    wanderDir.set(0, 0, 0)  // 가만히
            this.velocity.x = wanderDir.x * 1.5
            this.velocity.z = wanderDir.z * 1.5

        // 4. 물리 + 충돌
        this.updatePhysics(delta, world)

        // 5. 메시 위치/회전 갱신
        this.mesh.position.copy(this.position)
        this.mesh.rotation.y = this.rotation
}

// Zombie.ts
class Zombie extends Entity {
    private target: Player | null = null;
    private attackCooldown: number = 0;

    update(delta, world, player):
        // 플레이어 추적
        const distToPlayer = this.position.distanceTo(player.position);
        if distToPlayer < 20:
            this.target = player
            const dir = (player.position - this.position).normalize()
            this.velocity.x = dir.x * 2.5  // 좀비 속도
            this.velocity.z = dir.z * 2.5
            this.rotation = Math.atan2(dir.x, dir.z)

            // 공격
            if distToPlayer < 1.5 && attackCooldown <= 0:
                player.survival.takeDamage(2, DamageSource.Mob)
                attackCooldown = 1.0
        else:
            this.target = null
            // wandering

        attackCooldown -= delta
        this.updatePhysics(delta, world)
        this.mesh.position.copy(this.position)
}
```

### 엔티티 메시 (박스 기반)

```
돼지: 분홍색 박스
  ┌──┐
  │🟪│ 몸 (0.9×0.6×0.6)
  ├──┤
  │🟪│ 머리 (0.4×0.4×0.4, 앞쪽)
  └──┘
  4 다리 (0.2×0.3×0.2)

닭: 흰색 박스, 작음
  몸 (0.4×0.3×0.3), 먹이 (0.2×0.2×0.2), 부리 (노랑)

좀비: 초록색 박스, 인간형
  몸 (0.6×0.8×0.3), 머리 (0.5×0.5×0.5), 2 팔, 2 다리
```

### 스폰 로직

```
EntityManager.update(delta, world, player, isNight):
  // 동물 스폰 (낮)
  if !isNight && animals.length < 15:
    if random() < 0.02:  // 2% 확률/프레임
      spawnAnimalNearPlayer(player, world)

  // 좀비 스폰 (밤)
  if isNight && zombies.length < 8:
    if random() < 0.05:
      spawnZombieNearPlayer(player, world)

  // 좀비 소멸 (낮)
  if !isNight:
    for each zombie:
      zombie.burn(delta)  // 데미지 + 불 효과

  // 모든 엔티티 업데이트
  for each entity:
    entity.update(delta, world, player)
    if entity.dead:
      drops = entity.getDrops()
      // 인벤토리에 추가 (Feature 07)
      removeEntity(entity)

  // 거리 제한 (멀어면 디스폰)
  for each entity:
    if entity.position.distanceTo(player.position) > 60:
      removeEntity(entity)
```

### 스폰 위치

```
spawnAnimalNearPlayer(player, world):
  for attempt in 0..10:
    x = player.x + random(-20, 20)
    z = player.z + random(-20, 20)
    // 지표면 찾기
    for y = 60 downto 1:
      if world.isSolidAt(x, y, z) && world.getBlock(x, y+1, z) === Air:
        if getBiome(x, z) != Desert || entity instanceof Pig:
          spawn entity at (x+0.5, y+1, z+0.5)
          return
```

## 엔티티 애니메이션 (★ Oracle 검토 반영)

박스 파트를 별도 Mesh로 분리하여 최소한의 걷기 애니메이션 구현:

```
walkCycle += delta * moveSpeed * 8

leftFrontLeg.rotation.x = Math.sin(walkCycle) * 0.5
rightFrontLeg.rotation.x = -Math.sin(walkCycle) * 0.5
leftBackLeg.rotation.x = -Math.sin(walkCycle) * 0.5
rightBackLeg.rotation.x = Math.sin(walkCycle) * 0.5
```

## 스폰 시야 처리 (★ Oracle 검토 반영)

플레이어 시선 방향 ±60도 이내 스폰 금지 → 뒤쪽이나 측면에서 스폰.

## 의존성
- **Feature 03 (Day/Night)**: 밤 좀비 스폰 트리거
- **Feature 09 (Health/Hunger)**: 몹 공격 데미지
- **Feature 07 (Inventory)**: 동물 처치 시 고기 드롭 (선택)

## 성공 기준

- [ ] 낮에 동물이 스폰되어 돌아다닌다
- [ ] 동물이 wandering AI로 움직인다
- [ ] 플레이어 접근 시 동물이 도망간다
- [ ] 동물 공격 → 사망 → 드롭
- [ ] 밤에 좀비가 스폰된다
- [ ] 좀비가 플레이어를 추적한다
- [ ] 좀비 공격으로 플레이어 데미지
- [ ] 낮에 좀비가 소멸한다
- [ ] 엔티티 수 제한으로 성능 유지
- [ ] 60FPS 유지 (동물 15 + 좀비 8)

## 검증 방법

1. 낮에 게임 실행 → 동물 스폰 확인
2. 동물에 다가가기 → 도망 행동 확인
3. 동물 공격(좌클릭) → 사망 → 고기 드롭 확인
4. 밤으로 시간 스킵 → 좀비 스폰 확인
5. 좀비 추적 → 플레이어 데미지 확인
6. 다시 낮 → 좀비 소멸 확인
7. FPS 모니터링 (15+8 엔티티 상태)

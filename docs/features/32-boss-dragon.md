# 보스 드래곤 (Boss Dragon)

## 개요
LbinCraft의 하드엔딩 콘텐츠로서 거대한 드래곤 보스 엔티티를 구현합니다. 드래곤은 3단계 AI 패턴으로 플레이어에게 도전하며, 화염 브레스, 돌진, 광폭화 공격을 사용합니다. 드래곤을 처치하면 보상으로 다이아몬드와 드래곤 에그를 드롭합니다. 특정 구조물(엔드 포탈 대용)에 플레이어가 접근하면 드래곤이 스폰됩니다.

## 구현 범위
- DragonEntity 클래스: 대형 엔티티 (5x3x10 블록 크기), 체력 200
- 3단계 AI 패턴: 원거리 화염(50%+ HP) → 근접 돌진(25%+ HP) → 광폭화(10%+ HP)
- 화염 브레스 시스템: 파티클 데미지 영역, 블록 파괴 옵션
- 드래곤 애니메이션: 날갯짓, 머리 회전, 이동
- 보상 시스템: 다이아몬드 10-20개, 드래곤 에그(장식 블록)
- 스폰 트리거: 특정 구조물 접근 시 스폰
- 드래곤 둥지 구조물 자동 생성

## 수정 대상 파일
- `Entity.ts` - DragonEntity 상속을 위해 대형 엔티티 지원 추가 (size 속성)
- `EntityManager.ts` - DragonEntity 등록, 드래곤 생존 확인
- `Game.ts` - 드래곤 스폰 트리거 감지, 드래곤 특수 업데이트 루프
- `Survival.ts` - 화염 데미지 처리, 드래곤 처치 시 보상 인벤토리 추가
- `TerrainGenerator.ts` - 드래곤 둥지 구조물 생성 로직 추가

## 추가 파일
- `DragonEntity.ts` - 드래곤 엔티티 및 AI 로직
- `DragonBreath.ts` - 화염 브레스 파티클 및 데미지 시스템
- `DragonNestStructure.ts` - 드래곤 둥지 구조물 패턴
- `DragonEntity.test.ts` - 단위 테스트

## 데이터 구조

### DragonEntity
```typescript
class DragonEntity extends Entity {
  // 엔티티 크기 (블록 단위)
  override size = {width: 5, height: 3, depth: 10};

  // 드래곤 상태
  health: number = 200;
  maxHealth: number = 200;
  phase: DragonPhase = DragonPhase.RANGED; // RANGED(50%+), CHARGE(25%+), BERSERK(10%+)

  // AI 상태
  aiState: DragonAIState = 'idle';
  aiCooldown: number = 0;
  targetPosition: THREE.Vector3 | null = null;
  attackCooldown: number = 0;

  // 애니메이션 상태
  wingPhase: number = 0; // 0-1 날갯짓 사이클
  headRotation: THREE.Euler = new THREE.Euler();

  // 브레스 시스템
  breath: DragonBreath | null = null;
  breathDuration: number = 0;

  // 보상 플래그
  isDead: boolean = false;
  dropRewarded: boolean = false;

  // AI 업데이트 (매 프레임)
  updateAI(deltaTime: number, player: PlayerEntity): void {
    // HP에 따른 페이즈 전환
    this.updatePhase();

    // 현재 페이즈에 따른 AI 동작
    switch (this.phase) {
      case DragonPhase.RANGED:
        this.runRangedAI(deltaTime, player);
        break;
      case DragonPhase.CHARGE:
        this.runChargeAI(deltaTime, player);
        break;
      case DragonPhase.BERSERK:
        this.runBerserkAI(deltaTime, player);
        break;
    }

    // 애니메이션 업데이트
    this.updateAnimation(deltaTime);
  }

  // 페이즈 업데이트
  private updatePhase(): void {
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent > 0.5) {
      this.phase = DragonPhase.RANGED;
    } else if (healthPercent > 0.25) {
      this.phase = DragonPhase.CHARGE;
    } else {
      this.phase = DragonPhase.BERSERK;
    }
  }

  // 1단계 AI: 원거리 화염
  private runRangedAI(deltaTime: number, player: PlayerEntity): void {
    if (this.aiCooldown > 0) {
      this.aiCooldown -= deltaTime;
      return;
    }

    const distToPlayer = this.position.distanceTo(player.position);

    // 플레이어와 거리 유지 (20-30 블록)
    if (distToPlayer < 20) {
      // 멀어지기
      const away = this.position.clone().sub(player.position).normalize();
      this.velocity.add(away.multiplyScalar(0.5));
    } else if (distToPlayer > 30) {
      // 가까이 다가가기
      const toward = player.position.clone().sub(this.position).normalize();
      this.velocity.add(toward.multiplyScalar(0.3));
    }

    // 화염 브레스 공격
    if (this.attackCooldown <= 0 && distToPlayer < 40) {
      this.startBreathAttack(player);
      this.attackCooldown = 5; // 5초 쿨다운
    }

    this.aiCooldown = 0.1;
  }

  // 2단계 AI: 근접 돌진
  private runChargeAI(deltaTime: number, player: PlayerEntity): void {
    if (this.aiCooldown > 0) {
      this.aiCooldown -= deltaTime;
      return;
    }

    const distToPlayer = this.position.distanceTo(player.position);

    // 플레이어 방향으로 빠르게 이동
    if (distToPlayer > 15) {
      const toward = player.position.clone().sub(this.position).normalize();
      this.velocity.add(toward.multiplyScalar(1.0)); // 빠른 속도
    }

    // 근접 공격 (몸통 박치기)
    if (distToPlayer < 8 && this.attackCooldown <= 0) {
      // 플레이어 충돌 체크
      if (this.checkCollisionWithPlayer(player)) {
        this.meleeAttack(player, 15); // 15 데미지
      }
      this.attackCooldown = 3;
    }

    // 화염 브레스도 사용 (1단계보다 자주)
    if (this.attackCooldown <= 0 && distToPlayer < 30) {
      this.startBreathAttack(player);
      this.attackCooldown = 3;
    }

    this.aiCooldown = 0.05; // 더 빠른 반응
  }

  // 3단계 AI: 광폭화
  private runBerserkAI(deltaTime: number, player: PlayerEntity): void {
    if (this.aiCooldown > 0) {
      this.aiCooldown -= deltaTime;
      return;
    }

    // 플레이어에게 계속 다가감
    const toward = player.position.clone().sub(this.position).normalize();
    this.velocity.add(toward.multiplyScalar(1.5)); // 매우 빠름

    const distToPlayer = this.position.distanceTo(player.position);

    // 모든 공격 최대 빈도
    if (distToPlayer < 10 && this.attackCooldown <= 0) {
      this.meleeAttack(player, 20); // 20 데미지 (강화)
      this.attackCooldown = 1;
    }

    if (this.attackCooldown <= 0) {
      this.startBreathAttack(player);
      this.attackCooldown = 2;
    }

    // 랜덤 위치 순간이동 (예측 불가능)
    if (Math.random() < 0.01) {
      this.teleportNearPlayer(player);
    }

    this.aiCooldown = 0.02; // 매우 빠른 반응
  }

  // 화염 브레스 시작
  private startBreathAttack(player: PlayerEntity): void {
    const direction = player.position.clone().sub(this.position).normalize();
    this.breath = new DragonBreath(
      this.position.clone().add(direction.multiplyScalar(10)),
      direction,
      this.phase
    );
    this.breathDuration = 3; // 3초 지속
  }

  // 근접 공격
  private meleeAttack(player: PlayerEntity, damage: number): void {
    player.takeDamage(damage, 'dragon_melee');
  }

  // 순간이동
  private teleportNearPlayer(player: PlayerEntity): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 10;
    const offset = new THREE.Vector3(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance
    );
    this.position = player.position.clone().add(offset);
    this.velocity.set(0, 0, 0);
  }

  // 애니메이션 업데이트
  private updateAnimation(deltaTime: number): void {
    this.wingPhase += deltaTime * 2; // 날갯짓 속도
    if (this.wingPhase > 1) this.wingPhase -= 1;

    // 머리가 플레이어 방향을 향함
    if (this.targetPosition) {
      const lookDir = this.targetPosition.clone().sub(this.position).normalize();
      this.headRotation.y = Math.atan2(lookDir.x, lookDir.z);
    }
  }

  // 데미지 받기
  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }
}

// 드래곤 페이즈 enum
enum DragonPhase {
  RANGED = 'ranged',      // 50%+ HP
  CHARGE = 'charge',      // 25%+ HP
  BERSERK = 'berserk'     // 10%+ HP
}
```

### DragonBreath
```typescript
class DragonBreath {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  phase: DragonPhase;

  // 파티클 시스템
  particles: BreathParticle[] = [];
  particleLifetime: number = 2; // 파티클 수명 (초)

  // 블록 파괴 플래그
  canDestroyBlocks: boolean = true;

  constructor(origin: THREE.Vector3, direction: THREE.Vector3, phase: DragonPhase) {
    this.origin = origin;
    this.direction = direction;
    this.phase = phase;

    // 페이즈에 따른 강도
    if (phase === DragonPhase.BERSERK) {
      this.particleLifetime = 3;
    }
  }

  // 업데이트 및 데미지 적용
  update(deltaTime: number, world: World, player: PlayerEntity): void {
    // 새 파티클 생성
    this.spawnParticles();

    // 파티클 업데이트
    for (const particle of this.particles) {
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      particle.life -= deltaTime;

      // 플레이어 충돌 체크
      if (particle.position.distanceTo(player.position) < 2) {
        const damage = this.calculateDamage(this.phase);
        player.takeDamage(damage, 'dragon_breath');
        particle.life = 0;
      }

      // 블록 파괴
      if (this.canDestroyBlocks && particle.life <= 0) {
        const blockX = Math.floor(particle.position.x);
        const blockY = Math.floor(particle.position.y);
        const blockZ = Math.floor(particle.position.z);

        // 흙/돌/석재만 파괴 (베드락/철 블록 불가)
        const blockId = world.getBlock(blockX, blockY, blockZ);
        if (this.isDestructible(blockId)) {
          world.setBlock(blockX, blockY, blockZ, 0);
        }
      }
    }

    // 죽은 파티클 제거
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private spawnParticles(): void {
    const count = this.phase === DragonPhase.BERSERK ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const speed = 10 + Math.random() * 5;
      const velocity = this.direction.clone()
        .multiplyScalar(speed)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ));

      this.particles.push({
        position: this.origin.clone(),
        velocity: velocity,
        life: this.particleLifetime
      });
    }
  }

  private calculateDamage(phase: DragonPhase): number {
    switch (phase) {
      case DragonPhase.RANGED: return 8;
      case DragonPhase.CHARGE: return 12;
      case DragonPhase.BERSERK: return 18;
      default: return 8;
    }
  }

  private isDestructible(blockId: number): boolean {
    // 흙(2), 잔디(3), 돌(1), 석재 등 파괴 가능
    // 베드락(7), 흑요석(23) 등 파괴 불가
    return [0, 1, 2, 3, 4, 5, 6, 8, 9, 10].includes(blockId);
  }
}

interface BreathParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}
```

### DragonNestStructure
```typescript
class DragonNestStructure {
  // 드래곤 둥지 패턴 (50x50x30 공간)
  static generate(): StructureData {
    const structure: StructureData = {
      blocks: [],
      entities: [],
      spawnPoint: {x: 0, y: 20, z: 0}
    };

    // 1. 플랫폼 (50x30)
    for (let x = -25; x <= 25; x++) {
      for (let z = -15; z <= 15; z++) {
        structure.blocks.push({x, y: 18, z, blockId: 23}); // Obsidian
      }
    }

    // 2. 기둥 (4개)
    const pillarPositions = [
      {x: -20, z: -10}, {x: 20, z: -10},
      {x: -20, z: 10}, {x: 20, z: 10}
    ];
    for (const pos of pillarPositions) {
      for (let y = 18; y <= 28; y++) {
        structure.blocks.push({x: pos.x, y, z: pos.z, blockId: 23}); // Obsidian
      }
    }

    // 3. 천장
    for (let x = -25; x <= 25; x++) {
      for (let z = -15; z <= 15; z++) {
        structure.blocks.push({x, y: 30, z, blockId: 23}); // Obsidian
      }
    }

    // 4. 드래곤 에그 장식 (중앙)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      structure.blocks.push({
        x: Math.floor(Math.cos(angle) * 5),
        y: 19,
        z: Math.floor(Math.sin(angle) * 5),
        blockId: 50 // Dragon Egg Block
      });
    }

    // 5. 스폰 포인트 설정
    structure.spawnPoint = {x: 0, y: 22, z: 0};

    return structure;
  }
}

interface StructureData {
  blocks: {x, y, z, blockId}[];
  entities: any[];
  spawnPoint: {x, y, z};
}
```

## 핵심 로직

### 1. 드래곤 스폰 트리거
```typescript
// Game.ts
checkDragonSpawn(player: PlayerEntity): void {
  if (this.dragonSpawned) return;

  // 드래곤 둥지 구조물 위치 (예: X=500, Z=500)
  const nestPos = new THREE.Vector3(500, 20, 500);
  const distToNest = player.position.distanceTo(nestPos);

  // 둥지 근처(30 블록 이내)에 접근하면 스폰
  if (distToNest < 30) {
    this.spawnDragon();
  }
}

spawnDragon(): void {
  this.dragonSpawned = true;

  // 드래곤 엔티티 생성
  const dragon = new DragonEntity();
  dragon.position.set(500, 22, 500);
  dragon.rotation.y = Math.random() * Math.PI * 2;

  // 엔티티 매니저에 추가
  this.entityManager.spawn(dragon);

  // 스폰 애니메이션 (하늘에서 내려옴)
  dragon.velocity.y = -2;

  // 알림
  showNotification("드래곤이 깨어났습니다!");
  playSound('dragon_roar');
}
```

### 2. 드래곤 업데이트 루프
```typescript
// Game.ts 메인 루프
update(deltaTime: number): void {
  super.update(deltaTime);

  // 드래곤 업티트 업데이트
  const dragon = this.entityManager.getEntitiesByType(DragonEntity)[0];
  if (dragon && !dragon.isDead) {
    dragon.updateAI(deltaTime, this.player);

    // 화염 브레스 업데이트
    if (dragon.breath) {
      dragon.breath.update(deltaTime, this.world, this.player);
      dragon.breathDuration -= deltaTime;

      if (dragon.breathDuration <= 0) {
        dragon.breath = null;
      }
    }
  } else if (dragon && dragon.isDead && !dragon.dropRewarded) {
    // 드래곤 처치 시 보상 드롭
    this.rewardDragonKill(dragon);
    dragon.dropRewarded = true;
  }
}
```

### 3. 드래곤 처치 보상
```typescript
// Game.ts
rewardDragonKill(dragon: DragonEntity): void {
  // 1. 다이아몬드 10-20개 드롭
  const diamondCount = 10 + Math.floor(Math.random() * 11);
  for (let i = 0; i < diamondCount; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      0,
      (Math.random() - 0.5) * 5
    );
    this.spawnItemDrop(
      dragon.position.clone().add(offset),
      {itemId: 5, count: 1} // Diamond
    );
  }

  // 2. 드래곤 에그 1개 드롭
  this.spawnItemDrop(
    dragon.position.clone(),
    {itemId: 51, count: 1} // Dragon Egg Item
  );

  // 3. 인벤토리에 직접 추가
  for (let i = 0; i < diamondCount; i++) {
    this.player.inventory.addItem({itemId: 5, count: 1});
  }
  this.player.inventory.addItem({itemId: 51, count: 1});

  // 4. 알림 및 사운드
  showNotification(`드래곤 처치! 다이아몬드 ${diamondCount}개와 드래곤 에그 획득!`);
  playSound('dragon_death');

  // 5. 엔티티 제거
  this.entityManager.despawn(dragon);
}
```

### 4. 드래곤 둥지 생성 (TerrainGenerator 확장)
```typescript
// TerrainGenerator.ts
generateDragonNest(chunkX: number, chunkZ: number): void {
  // 드래곤 둥지 위치 (Chunk 31, 31)
  if (chunkX === 31 && chunkZ === 31) {
    const structure = DragonNestStructure.generate();

    for (const block of structure.blocks) {
      this.world.setBlock(
        chunkX * 16 + block.x,
        block.y,
        chunkZ * 16 + block.z,
        block.blockId
      );
    }

    // 월드에 스폰 포인트 저장
    this.world.setMetadata('dragonSpawnPoint', structure.spawnPoint);
  }
}
```

## 충돌/의존성
- **Entity.ts 의존성**: DragonEntity는 Entity를 상속받음. Entity에 size 속성 추가 필요 (대형 엔티티 지원)
- **EntityManager.ts 의존성**: DragonEntity를 등록하고 추적. 생존 상태 확인을 위해 타입 필터링 필요
- **Game.ts 의존성**: 드래곤 스폰 트리거, 업데이트 루프 통합. 기존 엔티티 업데이트와 충돌하지 않도록 주의
- **Survival.ts 의존성**: 화염 브레스 데미지 처리, 보상 인벤토리 추가. 데미지 소스 'dragon_breath', 'dragon_melee' 추가
- **TerrainGenerator.ts 의존성**: 드래곤 둥지 구조물 생성. 청크(31,31)에 특수 생성 로직 추가
- **충돌 위험**: 드래곤 화염 브레스가 너무 강력하면 게임 밸런스 깨질 수 있음. 데미지 값과 범위 조정 필요
- **성능 고려**: 파티클 시스템(화염 브레스)이 프레임에 영향을 줄 수 있음. 파티클 수 제한 필요

## 테스트 방법

### 1. 단위 테스트 (DragonEntity.test.ts)
```typescript
describe('DragonEntity', () => {
  test('should start in RANGED phase', () => {
    const dragon = new DragonEntity();
    expect(dragon.phase).toBe(DragonPhase.RANGED);
    expect(dragon.health).toBe(200);
  });

  test('should transition to CHARGE phase at 50% HP', () => {
    const dragon = new DragonEntity();
    dragon.takeDamage(100); // 100 데미지 = 50% HP
    expect(dragon.phase).toBe(DragonPhase.CHARGE);
  });

  test('should transition to BERSERK phase at 25% HP', () => {
    const dragon = new DragonEntity();
    dragon.takeDamage(150); // 150 데미지 = 25% HP
    expect(dragon.phase).toBe(DragonPhase.BERSERK);
  });

  test('should die at 0 HP', () => {
    const dragon = new DragonEntity();
    dragon.takeDamage(200);
    expect(dragon.health).toBe(0);
    expect(dragon.isDead).toBe(true);
  });

  test('should calculate breath damage correctly', () => {
    const breath = new DragonBreath(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      DragonPhase.RANGED
    );
    const damage = breath['calculateDamage'](DragonPhase.RANGED);
    expect(damage).toBe(8);
  });
});
```

### 2. 통합 테스트
- 드래곤 스폰 트리거: 둥지 근처 접근 시 정확히 스폰되는지 확인
- 페이즈 전환: HP에 따라 정확하게 3단계가 전환되는지 확인
- AI 동작: 각 페이즈에서 예상대로 공격 패턴을 사용하는지 확인
- 화염 브레스: 파티클이 플레이어에게 데미지를 주고 블록을 파괴하는지 확인
- 보상 드롭: 처치 시 정확한 개수의 다이아몬드와 에그가 드롭되는지 확인
- 드래곤 둥지: TerrainGenerator가 정확한 위치에 구조물을 생성하는지 확인

### 3. 수동 테스트 시나리오
1. 드래곤 둥지(500, 20, 500)까지 이동
2. 둥지 30 블록 내에 접근하면 드래곤 스폰 확인
3. 다이아몬드 검으로 드래곤 공격 (HP 200)
4. HP 100 이하가 되면 CHARGE 페이즈 전환 확인
5. HP 50 이하가 되면 BERSERK 페이즈 전환 확인
6. 각 페이즈에서 다른 공격 패턴 사용 확인
7. 드래곤 처치 후 다이아몬드 10-20개와 에그 1개 드롭 확인
8. 인벤토리에 아이템이 올바르게 추가되는지 확인
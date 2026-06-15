# 차원 포탈 (Dimension Portal)

## 개요
LbinCraft에 차원 시스템을 도입하여 오버월드 외에 넥더(Nether) 차원을 구현합니다. 특정 블록(흑요석=23)으로 4x5 프레임을 구성하고 중앙을 점화하여 포탈을 활성화합니다. 포탈 진입 시 별도의 World 인스턴스로 전환되며, 넥더 월드는 용암 바다, 넥더랙(어두운 돌), 가시밭, 넥더 요새 등의 독특한 지형을 갖습니다. 차원 간 아이템과 체력은 유지됩니다.

## 구현 번위
- 포탈 구성: 흑요석(23) 4x5 프레임 + 중앙 점화
- 포탈 활성화: 부싯돌/강철 점화로 포탈 생성
- 월드 인스턴스 분리: 오버월드와 넥더 각각 World 인스턴스
- 넥더 TerrainGenerator: 용암 바다, 넥더랙(27), 가시밭(28), 넥더 요새
- 포탈 진입 감지: 엔티티가 포탈 블록 안에 있을 때 전환
- 차원 전환 애니메이션: 페이드 아웃/인 + 로딩 화면
- 데이터 유지: 인벤토리, 체력, 위치(상대 좌표) 보존
- 양방향 포탈: 넥더에서 오버월드로 돌아오는 포탈 자동 생성

## 수정 대상 파일
- `Game.ts` - 월드 인스턴스 관리, 포탈 진입 감지, 차원 전환 로직
- `World.ts` - 차원 식별자(dimension) 추가, 포탈 블록(29) 지원
- `TerrainGenerator.ts` - 넥더 지형 생성 로직 추가
- `Entity.ts` - 엔티티의 현재 차원 추적
- `Inventory.ts` - 인벤토리 데이터 차원 간 유지 (변경 없음, 자동 지원)
- `Survival.ts` - 체력 데이터 차원 간 유지 (변경 없음, 자동 지원)

## 추가 파일
- `DimensionManager.ts` - 차원 전환 관리자
- `PortalSystem.ts` - 포탈 생성 및 활성화
- `NetherTerrainGenerator.ts` - 넥더 지형 생성
- `DimensionManager.test.ts` - 단위 테스트

## 데이터 구조

### DimensionManager
```typescript
class DimensionManager {
  private worlds: Map<Dimension, World> = new Map();
  private currentDimension: Dimension = Dimension.OVERWORLD;
  private transitionCooldown: number = 0;
  private readonly TRANSITION_DELAY = 3; // 3초 쿨다운

  // 월드 초기화
  initialize(seed: number): void {
    // 오버월드 생성
    const overworldWorld = new World(seed, Dimension.OVERWORLD);
    const overworldGenerator = new TerrainGenerator(overworldWorld, seed);
    overworldWorld.setTerrainGenerator(overworldGenerator);
    this.worlds.set(Dimension.OVERWORLD, overworldWorld);

    // 넥더 생성
    const netherWorld = new World(seed, Dimension.NETHER);
    const netherGenerator = new NetherTerrainGenerator(netherWorld, seed);
    netherWorld.setTerrainGenerator(netherGenerator);
    this.worlds.set(Dimension.NETHER, netherWorld);
  }

  // 현재 월드 가져오기
  getCurrentWorld(): World {
    return this.worlds.get(this.currentDimension)!;
  }

  // 다른 차원의 월드 가져오기
  getWorld(dimension: Dimension): World | null {
    return this.worlds.get(dimension) || null;
  }

  // 현재 차원 가져오기
  getCurrentDimension(): Dimension {
    return this.currentDimension;
  }

  // 차원 전환
  async transitionTo(
    targetDimension: Dimension,
    player: PlayerEntity,
    game: Game
  ): Promise<boolean> {
    // 쿨다운 체크
    if (this.transitionCooldown > 0) {
      return false;
    }

    // 동일 차원이면 전환 불필요
    if (targetDimension === this.currentDimension) {
      return false;
    }

    // 전환 시작
    this.transitionCooldown = this.TRANSITION_DELAY;

    // 1. 페이드 아웃 애니메이션
    await game.playTransitionAnimation('fade_out');

    // 2. 플레이어 데이터 저장 (현재 차원)
    const playerData = this.savePlayerData(player);

    // 3. 차원 전환
    this.currentDimension = targetDimension;
    const newWorld = this.getCurrentWorld();

    // 4. 플레이어 데이터 로드 (새 차원)
    this.loadPlayerData(player, playerData);

    // 5. 게임 월드 교체
    game.setWorld(newWorld);

    // 6. 로딩 화면
    await game.showLoadingScreen();

    // 7. 페이드 인 애니메이션
    await game.playTransitionAnimation('fade_in');

    // 8. 사운드 효과
    if (targetDimension === Dimension.NETHER) {
      playSound('portal_enter_nether');
    } else {
      playSound('portal_enter_overworld');
    }

    return true;
  }

  // 업데이트 (쿨다운 감소)
  update(deltaTime: number): void {
    if (this.transitionCooldown > 0) {
      this.transitionCooldown -= deltaTime;
    }
  }

  // 플레이어 데이터 저장
  private savePlayerData(player: PlayerEntity): PlayerData {
    return {
      inventory: player.inventory.serialize(),
      health: player.health,
      hunger: player.hunger,
      overworldPosition: player.overworldPosition.clone(),
      netherPosition: player.netherPosition.clone()
    };
  }

  // 플레이어 데이터 로드
  private loadPlayerData(player: PlayerEntity, data: PlayerData): void {
    // 인벤토리 복원
    player.inventory.deserialize(data.inventory);

    // 체력/허기 복원
    player.health = data.health;
    player.hunger = data.hunger;

    // 위치 복원 (현재 차원에 맞는 위치)
    if (this.currentDimension === Dimension.OVERWORLD) {
      player.position.copy(data.overworldPosition);
    } else {
      player.position.copy(data.netherPosition);
    }
  }

  // 역할 포탈 생성 (오버월드 ↔ 넥더)
  createReturnPortal(fromDimension: Dimension, position: THREE.Vector3, world: World): void {
    const portalSystem = new PortalSystem(world);

    // 현재 차원의 포탈 생성
    portalSystem.createPortal(position.x, position.y, position.z);

    // 다른 차원의 위치 계산
    const targetPosition = this.calculateLinkPosition(fromDimension, position);

    // 다른 차원에 포탈 생성
    const targetWorld = this.getWorld(fromDimension === Dimension.OVERWORLD ? Dimension.NETHER : Dimension.OVERWORLD);
    if (targetWorld) {
      const targetPortalSystem = new PortalSystem(targetWorld);
      targetPortalSystem.createPortal(targetPosition.x, targetPosition.y, targetPosition.z);
    }
  }

  // 연결 위치 계산 (오버월드 ↔ 넥더 좌표 변환)
  private calculateLinkPosition(fromDimension: Dimension, position: THREE.Vector3): THREE.Vector3 {
    // 넥더 → 오버월드: 8배 축소
    // 오버월드 → 넥더: 8배 확대
    const scale = fromDimension === Dimension.NETHER ? 8 : 1/8;

    return new THREE.Vector3(
      Math.floor(position.x * scale),
      Math.floor(position.y), // Y 좌표는 동일
      Math.floor(position.z * scale)
    );
  }
}

// 차원 enum
enum Dimension {
  OVERWORLD = 'overworld',
  NETHER = 'nether'
}

// 플레이어 데이터
interface PlayerData {
  inventory: any; // 직렬화된 인벤토리
  health: number;
  hunger: number;
  overworldPosition: THREE.Vector3;
  netherPosition: THREE.Vector3;
}
```

### PortalSystem
```typescript
class PortalSystem {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  // 포탈 프레임 확인 (4x5 흑요석)
  isPortalFrame(x: number, y: number, z: number): boolean {
    // X축 방향 프레임 체크
    if (this.checkXAxisFrame(x, y, z)) return true;

    // Z축 방향 프레임 체크
    if (this.checkZAxisFrame(x, y, z)) return true;

    return false;
  }

  // X축 방향 프레임 체크 (4x5)
  private checkXAxisFrame(x: number, y: number, z: number): boolean {
    // 프레임 크기: 폭 4, 높이 5
    const width = 4;
    const height = 5;

    // 상하 프레임 확인
    for (let dx = 0; dx < width; dx++) {
      if (this.world.getBlock(x + dx, y, z) !== 23) return false; // 상부 흑요석
      if (this.world.getBlock(x + dx, y + height - 1, z) !== 23) return false; // 하부 흑요석
    }

    // 좌우 프레임 확인
    for (let dy = 1; dy < height - 1; dy++) {
      if (this.world.getBlock(x, y + dy, z) !== 23) return false; // 좌측 흑요석
      if (this.world.getBlock(x + width - 1, y + dy, z) !== 23) return false; // 우측 흑요석
    }

    // 내부 비어있는지 확인
    for (let dx = 1; dx < width - 1; dx++) {
      for (let dy = 1; dy < height - 1; dy++) {
        if (this.world.getBlock(x + dx, y + dy, z) !== 0) return false; // 비어있어야 함
      }
    }

    return true;
  }

  // Z축 방향 프레임 체크 (4x5)
  private checkZAxisFrame(x: number, y: number, z: number): boolean {
    const width = 4;
    const height = 5;

    // 상하 프레임 확인
    for (let dz = 0; dz < width; dz++) {
      if (this.world.getBlock(x, y, z + dz) !== 23) return false;
      if (this.world.getBlock(x, y + height - 1, z + dz) !== 23) return false;
    }

    // 좌우 프레임 확인
    for (let dy = 1; dy < height - 1; dy++) {
      if (this.world.getBlock(x, y + dy, z) !== 23) return false;
      if (this.world.getBlock(x, y + dy, z + width - 1) !== 23) return false;
    }

    // 내부 비어있는지 확인
    for (let dz = 1; dz < width - 1; dz++) {
      for (let dy = 1; dy < height - 1; dy++) {
        if (this.world.getBlock(x, y + dy, z + dz) !== 0) return false;
      }
    }

    return true;
  }

  // 포탈 활성화
  activatePortal(x: number, y: number, z: number): boolean {
    if (!this.isPortalFrame(x, y, z)) {
      return false;
    }

    // 방향 결정
    const direction = this.determineDirection(x, y, z);

    // 포탈 블록 생성
    this.fillPortal(x, y, z, direction);

    return true;
  }

  // 방향 결정
  private determineDirection(x: number, y: number, z: number): PortalDirection {
    if (this.checkXAxisFrame(x, y, z)) {
      return PortalDirection.X_AXIS;
    } else if (this.checkZAxisFrame(x, y, z)) {
      return PortalDirection.Z_AXIS;
    }
    return PortalDirection.X_AXIS;
  }

  // 포탈 블록 채우기
  private fillPortal(x: number, y: number, z: number, direction: PortalDirection): void {
    const width = 4;
    const height = 5;

    if (direction === PortalDirection.X_AXIS) {
      // X축 방향 포탈
      for (let dx = 1; dx < width - 1; dx++) {
        for (let dy = 1; dy < height - 1; dy++) {
          this.world.setBlock(x + dx, y + dy, z, 29); // Portal Block
        }
      }
    } else {
      // Z축 방향 포탈
      for (let dz = 1; dz < width - 1; dz++) {
        for (let dy = 1; dy < height - 1; dy++) {
          this.world.setBlock(x, y + dy, z + dz, 29); // Portal Block
        }
      }
    }
  }

  // 포탄 생성 (위치 지정)
  createPortal(x: number, y: number, z: number): void {
    // 기본적으로 X축 방향으로 생성
    // 프레임 자동 생성
    for (let dx = 0; dx < 4; dx++) {
      this.world.setBlock(x + dx, y, z, 23); // 상부
      this.world.setBlock(x + dx, y + 4, z, 23); // 하부
    }

    for (let dy = 1; dy < 4; dy++) {
      this.world.setBlock(x, y + dy, z, 23); // 좌측
      this.world.setBlock(x + 3, y + dy, z, 23); // 우측
    }

    // 내부 포탈 블록 생성
    this.fillPortal(x, y, z, PortalDirection.X_AXIS);
  }

  // 포탄 비활성화 (블록 파괴 시)
  deactivatePortal(x: number, y: number, z: number): void {
    // 포탄 주변의 포탈 블록 모두 제거
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dz = -3; dz <= 3; dz++) {
          if (this.world.getBlock(x + dx, y + dy, z + dz) === 29) {
            this.world.setBlock(x + dx, y + dy, z + dz, 0);
          }
        }
      }
    }
  }
}

// 포탄 방향
enum PortalDirection {
  X_AXIS = 'x_axis',
  Z_AXIS = 'z_axis'
}
```

### NetherTerrainGenerator
```typescript
class NetherTerrainGenerator extends TerrainGenerator {
  constructor(world: World, seed: number) {
    super(world, seed);
  }

  // 넥더 지형 생성
  generateChunk(chunkX: number, chunkZ: number): void {
    // 1. 넥더랙 기본층 생성
    this.generateNetherrackLayer(chunkX, chunkZ);

    // 2. 용암 바다 생성
    this.generateLavaSeas(chunkX, chunkZ);

    // 3. 가시밭 생성
    this.generateSoulSand(chunkX, chunkZ);

    // 4. 넥더 요새 구조물 생성
    this.generateNetherFortress(chunkX, chunkZ);

    // 5. 넥더 광석 생성
    this.generateNetherOres(chunkX, chunkZ);
  }

  // 넥더랙 기본층 생성
  private generateNetherrackLayer(chunkX: number, chunkZ: number): void {
    const worldX = chunkX * 16;
    const worldZ = chunkZ * 16;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const globalX = worldX + x;
        const globalZ = worldZ + z;

        // 높이 노이즈
        const heightNoise = this.noise2D(globalX * 0.02, globalZ * 0.02);
        const height = Math.floor(32 + heightNoise * 10); // 22-42 높이

        // 바닥부터 높이까지 넥더랙 채우기
        for (let y = 0; y < height; y++) {
          this.world.setBlock(globalX, y, globalZ, 27); // Netherrack
        }

        // 상부에 몇 블록은 넥더랙
        for (let y = height; y < height + 3; y++) {
          this.world.setBlock(globalX, y, globalZ, 27); // Netherrack
        }
      }
    }
  }

  // 용암 바다 생성
  private generateLavaSeas(chunkX: number, chunkZ: number): void {
    const worldX = chunkX * 16;
    const worldZ = chunkZ * 16;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const globalX = worldX + x;
        const globalZ = worldZ + z;

        // 용암 바다 노이즈 (낮은 곳에 용암)
        const seaNoise = this.noise2D(globalX * 0.01, globalZ * 0.01);

        if (seaNoise < -0.3) {
          // 낮은 곳에 용암 바다 (Y=30 이하)
          for (let y = 0; y < 31; y++) {
            const currentBlock = this.world.getBlock(globalX, y, globalZ);
            if (currentBlock === 27) { // Netherrack
              this.world.setBlock(globalX, y, globalZ, 30); // Lava
            }
          }
        }
      }
    }
  }

  // 가시밭 생성
  private generateSoulSand(chunkX: number, chunkZ: number): void {
    const worldX = chunkX * 16;
    const worldZ = chunkZ * 16;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const globalX = worldX + x;
        const globalZ = worldZ + z;

        // 가시밭 노이즈 (랜덤 패치)
        const soulNoise = this.noise2D(globalX * 0.05, globalZ * 0.05);

        if (soulNoise > 0.4) {
          // 가장 높은 넥더랙 위에 가시밭
          for (let y = 64; y >= 0; y--) {
            const block = this.world.getBlock(globalX, y, globalZ);
            if (block === 27) { // Netherrack
              this.world.setBlock(globalX, y + 1, globalZ, 28); // Soul Sand
              break;
            }
          }
        }
      }
    }
  }

  // 넥더 요새 생성
  private generateNetherFortress(chunkX: number, chunkZ: number): void {
    // 200x200 청크마다 1개 요새 (약 2.5% 확률)
    if (!this.shouldSpawnFortress(chunkX, chunkZ)) {
      return;
    }

    const worldX = chunkX * 16 + 8;
    const worldZ = chunkZ * 16 + 8;

    // 요새 구조물 생성
    this.buildFortress(worldX, worldZ);
  }

  // 요새 스폰 조건
  private shouldSpawnFortress(chunkX: number, chunkZ: number): boolean {
    const gridSize = 200;
    const gridX = Math.floor(chunkX / gridSize);
    const gridZ = Math.floor(chunkZ / gridSize);

    // 격자 기반 결정
    const gridIndex = gridX * 1000 + gridZ;
    const rng = new SeededRandom(this.seed + gridIndex);

    return rng.random() < 0.025;
  }

  // 요새 건설
  private buildFortress(x: number, z: number): void {
    const baseY = 30;
    const width = 20;
    const depth = 30;
    const height = 15;

    // 1. 넥더 벽돌(31) 기초
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < depth; dz++) {
        for (let dy = 0; dy < height; dy++) {
          // 외벽만 넥더 벽돌
          if (dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1 || dy === 0 || dy === height - 1) {
            this.world.setBlock(x + dx - width/2, baseY + dy, z + dz - depth/2, 31); // Nether Brick
          }
        }
      }
    }

    // 2. 내부 빈 공간
    for (let dx = 1; dx < width - 1; dx++) {
      for (let dz = 1; dz < depth - 1; dz++) {
        for (let dy = 1; dy < height - 1; dy++) {
          this.world.setBlock(x + dx - width/2, baseY + dy, z + dz - depth/2, 0); // Air
        }
      }
    }

    // 3. 복도와 방 (랜덤 구조)
    // ... (요새 내부 구조)
  }

  // 넥더 광석 생성
  private generateNetherOres(chunkX: number, chunkZ: number): void {
    const worldX = chunkX * 16;
    const worldZ = chunkZ * 16;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const globalX = worldX + x;
        const globalZ = worldZ + z;

        // 넥더 석영(32) 광석 생성 (Y=15-40)
        const quartzNoise = this.noise3D(globalX * 0.1, 15, globalZ * 0.1);
        if (quartzNoise > 0.7) {
          const oreY = 15 + Math.floor(Math.random() * 25); // 15-40
          this.world.setBlock(globalX, oreY, globalZ, 32); // Nether Quartz Ore
        }

        // 넥더 금(33) 광석 생성 (Y=5-30)
        const goldNoise = this.noise3D(globalX * 0.1, 20, globalZ * 0.1);
        if (goldNoise > 0.8) {
          const oreY = 5 + Math.floor(Math.random() * 25); // 5-30
          this.world.setBlock(globalX, oreY, globalZ, 33); // Nether Gold Ore
        }
      }
    }
  }

  // 3D 노이즈 (광석 생성용)
  private noise3D(x: number, y: number, z: number): number {
    // 단순 3D 노이즈 (Perlin Noise 라이브러리 필요)
    return (Math.sin(x * 0.1) + Math.cos(y * 0.1) + Math.sin(z * 0.1)) / 3;
  }
}
```

## 핵심 로직

### 1. 포탈 생성 (오버월드에서 넥더로)
```typescript
// Game.ts 우클릭 이벤트
onRightClick(blockX, blockY, blockZ): void {
  const blockId = this.world.getBlock(blockX, blockY, blockZ);

  // 흑요석(23)에 부싯돌/강철로 점화 시 포탈 활성화 시도
  if (blockId === 23 && this.heldItem.itemId === 17) { // Flint and Steel
    const portalSystem = new PortalSystem(this.world);

    // 포탈 프레임 확인
    if (portalSystem.isPortalFrame(blockX, blockY, blockZ)) {
      // 포탈 활성화
      const success = portalSystem.activatePortal(blockX, blockY, blockZ);
      if (success) {
        showNotification("포탈이 활성화되었습니다!");
        playSound('portal_activate');

        // 넥더에 반환 포탈 생성
        this.dimensionManager.createReturnPortal(
          Dimension.OVERWORLD,
          new THREE.Vector3(blockX, blockY, blockZ),
          this.world
        );
      }
    }
  }

  // 기존 블록 상호작용
  // ...
}
```

### 2. 포탈 진입 감지 및 차원 전환
```typescript
// Game.ts 업데이트 루프
update(deltaTime: number): void {
  super.update(deltaTime);

  // 차원 매니저 업데이트
  this.dimensionManager.update(deltaTime);

  // 포탈 진입 감지
  const playerPos = this.player.position;
  const blockX = Math.floor(playerPos.x);
  const blockY = Math.floor(playerPos.y);
  const blockZ = Math.floor(playerPos.z);

  const currentBlock = this.world.getBlock(blockX, blockY, blockZ);

  // 포탈 블록(29)에 있을 때 차원 전환
  if (currentBlock === 29) {
    const currentDim = this.dimensionManager.getCurrentDimension();
    const targetDim = currentDim === Dimension.OVERWORLD ? Dimension.NETHER : Dimension.OVERWORLD;

    // 플레이어 위치 저장 (현재 차원)
    if (currentDim === Dimension.OVERWORLD) {
      this.player.overworldPosition.copy(playerPos);
    } else {
      this.player.netherPosition.copy(playerPos);
    }

    // 차원 전환
    this.dimensionManager.transitionTo(targetDim, this.player, this);
  }
}
```

### 3. 차원 전환 애니메이션
```typescript
// Game.ts
async playTransitionAnimation(type: 'fade_out' | 'fade_in'): Promise<void> {
  return new Promise((resolve) => {
    const duration = 1000; // 1초
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (type === 'fade_out') {
        this.overlayMaterial.opacity = progress;
      } else {
        this.overlayMaterial.opacity = 1 - progress;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    animate();
  });
}

async showLoadingScreen(): Promise<void> {
  return new Promise((resolve) => {
    // 로딩 화면 표시
    this.loadingScreen.visible = true;

    // 청크 로딩 대기
    setTimeout(() => {
      this.loadingScreen.visible = false;
      resolve();
    }, 500);
  });
}
```

### 4. 월드 교체
```typescript
// Game.ts
setWorld(world: World): void {
  // 기존 월드 정리
  if (this.world) {
    this.world.cleanup();
  }

  // 새 월드 설정
  this.world = world;

  // 기존 청크 메시 제거
  this.scene.remove(this.chunkMeshes);
  this.chunkMeshes = new THREE.Group();
  this.scene.add(this.chunkMeshes);

  // 새 청크 로딩
  this.loadChunksAroundPlayer();
}
```

### 5. 포탈 블록 파괴 시 비활성화
```typescript
// Game.ts 블록 파괴 이벤트
onBlockBreak(blockX, blockY, blockZ): void {
  const blockId = this.world.getBlock(blockX, blockY, blockZ);

  // 포탈 블록(29) 파괴 시 포탈 비활성화
  if (blockId === 29) {
    const portalSystem = new PortalSystem(this.world);
    portalSystem.deactivatePortal(blockX, blockY, blockZ);
    showNotification("포탈이 비활성화되었습니다.");
  }

  // 기존 블록 파괴 로직
  // ...
}
```

## 충돌/의존성
- **Game.ts 의존성**: DimensionManager 통합, 포탈 진입 감지, 차원 전환 로직. 기존 월드 관리와 충돌하지 않도록 주의
- **World.ts 의존성**: 차원 식별자(dimension) 추가, 포탈 블록(29) 지원. 기존 지형 생성과 호환
- **TerrainGenerator.ts 의존성**: 넥더 지형 생성 로직 추가. 기존 오버월드 지형과 충돌하지 않도록 별도 클래스 사용
- **Entity.ts 의존성**: 엔티티의 현재 차원 추적. 플레이어 위치 저장을 위해 overworldPosition, netherPosition 추가 필요
- **Inventory.ts 의존성**: 인벤토리 데이터 차원 간 유지 (자동 지원, 변경 불필요)
- **Survival.ts 의존성**: 체력 데이터 차원 간 유지 (자동 지원, 변경 불필요)
- **충돌 위험**: 차원 전환 시 청크 로딩이 느리면 게임 프리즈 발생 가능. 로딩 화면과 비동기 처리 필요
- **좌표 변환**: 오버월드 ↔ 넥더 좌표 변환(8배) 시 소수점 오차 주의. Math.floor 사용하여 정수 좌표 유지
- **성능 고려**: 두 개의 World 인스턴스가 동시에 메모리에 존재하므로 메모리 사용량 증가. 필요한 경우만 청크 로드

## 테스트 방법

### 1. 단위 테스트 (DimensionManager.test.ts)
```typescript
describe('DimensionManager', () => {
  test('should initialize both dimensions', () => {
    const manager = new DimensionManager();
    manager.initialize(12345);

    expect(manager.getWorld(Dimension.OVERWORLD)).not.toBeNull();
    expect(manager.getWorld(Dimension.NETHER)).not.toBeNull();
    expect(manager.getCurrentDimension()).toBe(Dimension.OVERWORLD);
  });

  test('should switch dimensions', async () => {
    const manager = new DimensionManager();
    manager.initialize(12345);
    const player = new PlayerEntity();
    const game = new Game();

    const success = await manager.transitionTo(Dimension.NETHER, player, game);
    expect(success).toBe(true);
    expect(manager.getCurrentDimension()).toBe(Dimension.NETHER);
  });

  test('should preserve inventory across dimensions', async () => {
    const manager = new DimensionManager();
    manager.initialize(12345);
    const player = new PlayerEntity();
    player.inventory.addItem({itemId: 5, count: 10}); // Diamond

    const game = new Game();
    await manager.transitionTo(Dimension.NETHER, player, game);

    // 다이아몬드 10개 유지 확인
    const diamondStack = player.inventory.findStackByItemId(5);
    expect(diamondStack).not.toBeNull();
    expect(diamondStack!.count).toBe(10);
  });

  test('should preserve health across dimensions', async () => {
    const manager = new DimensionManager();
    manager.initialize(12345);
    const player = new PlayerEntity();
    player.health = 15;

    const game = new Game();
    await manager.transitionTo(Dimension.NETHER, player, game);

    expect(player.health).toBe(15);
  });

  test('should calculate link position correctly', () => {
    const manager = new DimensionManager();

    // 오버월드 → 넥더: 8배 확대
    const overworldPos = new THREE.Vector3(80, 32, 80);
    const netherPos = manager['calculateLinkPosition'](Dimension.OVERWORLD, overworldPos);

    expect(netherPos.x).toBe(10); // 80 / 8
    expect(netherPos.y).toBe(32); // Y는 동일
    expect(netherPos.z).toBe(10); // 80 / 8

    // 넥더 → 오버월드: 8배 축소
    const netherPos2 = new THREE.Vector3(10, 32, 10);
    const overworldPos2 = manager['calculateLinkPosition'](Dimension.NETHER, netherPos2);

    expect(overworldPos2.x).toBe(80); // 10 * 8
    expect(overworldPos2.y).toBe(32); // Y는 동일
    expect(overworldPos2.z).toBe(80); // 10 * 8
  });
});

describe('PortalSystem', () => {
  test('should detect X-axis portal frame', () => {
    const world = new World();
    const portalSystem = new PortalSystem(world);

    // 4x5 흑요석 프레임 생성
    for (let dx = 0; dx < 4; dx++) {
      world.setBlock(dx, 0, 0, 23); // 상부
      world.setBlock(dx, 4, 0, 23); // 하부
    }
    for (let dy = 1; dy < 4; dy++) {
      world.setBlock(0, dy, 0, 23); // 좌측
      world.setBlock(3, dy, 0, 23); // 우측
    }

    expect(portalSystem.isPortalFrame(0, 0, 0)).toBe(true);
  });

  test('should activate portal', () => {
    const world = new World();
    const portalSystem = new PortalSystem(world);

    // 프레임 생성 (위와 동일)
    for (let dx = 0; dx < 4; dx++) {
      world.setBlock(dx, 0, 0, 23);
      world.setBlock(dx, 4, 0, 23);
    }
    for (let dy = 1; dy < 4; dy++) {
      world.setBlock(0, dy, 0, 23);
      world.setBlock(3, dy, 0, 23);
    }

    const success = portalSystem.activatePortal(0, 0, 0);
    expect(success).toBe(true);

    // 내부에 포탈 블록(29) 생성 확인
    expect(world.getBlock(1, 1, 0)).toBe(29);
    expect(world.getBlock(2, 1, 0)).toBe(29);
    // ... (내부 모든 블록이 포탈 블록인지 확인)
  });

  test('should deactivate portal', () => {
    const world = new World();
    const portalSystem = new PortalSystem(world);

    // 포탈 생성
    portalSystem.createPortal(10, 20, 30);

    // 포탈 비활성화
    portalSystem.deactivatePortal(11, 21, 30);

    // 포탈 블록 제거 확인
    expect(world.getBlock(11, 21, 30)).not.toBe(29);
    expect(world.getBlock(12, 21, 30)).not.toBe(29);
  });
});
```

### 2. 통합 테스트
- 포탄 생성: 흑요석 프레임 + 부싯돌로 포탄이 활성화되는지 확인
- 포탈 진입: 포탈 블록 안에 있을 때 차원이 전환되는지 확인
- 차원 전환: 오버월드 ↔ 넥더 간 전환이 원활한지 확인
- 데이터 유지: 인벤토리, 체력이 차원 간 유지되는지 확인
- 위치 저장: 각 차원에서의 위치가 올바르게 저장/복원되는지 확인
- 반환 포탄: 넥더에 올바른 위치에 반환 포탈이 생성되는지 확인
- 넥더 지형: 넥더랙, 용암 바다, 가시밭이 올바르게 생성되는지 확인
- 넥더 요새: 넥더 요새가 드물게 올바르게 생성되는지 확인
- 좌표 변환: 오버월드 ↔ 넥더 좌표 변환(8배)이 정확한지 확인

### 3. 수동 테스트 시나리오
1. 흑요석(23) 20개 수집 (채굴 또는 크리에이티브 모드)
2. 4x5 흑요석 프레임 구성 (X축 방향)
3. 부싯돌/강철(17)로 프레임 점화
4. 포탄 활성화 확인 (내부에 보라색 포탈 블록 생성)
5. 포탈 안으로 이동하여 차원 전환 확인
6. 넥더 도착 (로딩 화면 + 페이드 인)
7. 넥더 지형 확인 (넥더랙, 용암 바다, 가시밭)
8. 다이아몬드 검으로 넥더랙 채굴 (인벤토리 확인)
9. 넥더 포탈로 오버월드로 돌아가기
10. 오버월드 도착 후 다이아몬드 검이 인벤토리에 있는지 확인
11. 체력이 유지되는지 확인
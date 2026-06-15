# 28. 화산 바이옴 (Volcano Biome)

## 개요
새로운 바이옴으로 화산을 추가한다. 용암 블록(Lava=21)을 구현하고, 원뿔형 화산 지형과 정상의 용암 호수, 주변의 현무암 지형을 생성한다. 플레이어가 용암에 닿을 시 데미지를 입는다.

## 구현 범위
- BiomeId.Volcano 추가, BiomeType 정의
- 용암 블록(Lava=21): Water와 유사하나 데미지, 느른 흐름, 빨간색
- 화산 지형: 원뿔형 산, 정상에 용암 호수, 주변 현무암
- Temperature/Humidity 노이즈에 고온 영역 추가
- Lava 데미지: 접촉 시 4/초, Survival.takeDamage

## 수정 대상 파일
- `src/world/TerrainGenerator.ts`: 화산 지형 생성, 노이즈 수정
- `src/world/Biome.ts`: BiomeId.Volcano, BiomeType 정의
- `src/data/Block.ts`: 용암 블록 ID 추가
- `src/entities/Player.ts`: 용암 데미지 처리
- `src/survival/Survival.ts`: 데미지 계산

## 추가 파일
- `src/world/VolcanoGenerator.ts`: 화산 지형 생성 전담
- `src/fluids/LavaFluid.ts`: 용암 액체 시뮬레이션
- `src/particles/LavaParticles.ts`: 용암 파티클 효과

## 데이터 구조
```typescript
// 바이옴 ID 확장
enum BiomeId {
  Plains = 0,
  Forest = 1,
  Desert = 2,
  Volcano = 3,  // 추가
  // ...
}

// 용암 블록
interface LavaBlock extends Block {
  id: BlockId.Lava;
  level: number;           // 용암 레벨 (0-7, 0=완전 용암)
  flowing: boolean;        // 흐르는지 여부
  temperature: number;     // 온도 (1000-1200°C)
}

// 화산 구조
interface VolcanoStructure {
  center: Vector2;         // 화산 중심 (x, z)
  radius: number;          // 화산 반경
  height: number;          // 화산 높이
  craterRadius: number;    // 분화구 반경
  lavaDepth: number;       // 용암 깊이
}
```

## 핵심 로직

### 1. 바이옴 정의
```typescript
// Biome.ts
enum BiomeType {
  TEMPERATE = 0,
  TROPICAL = 1,
  ARID = 2,
  VOLCANIC = 3  // 추가
}

const BIOME_DEFINITIONS = {
  [BiomeId.Plains]: { type: BiomeType.TEMPERATE, baseHeight: 20, heightVariation: 5 },
  [BiomeId.Forest]: { type: BiomeType.TEMPERATE, baseHeight: 25, heightVariation: 8 },
  [BiomeId.Desert]: { type: BiomeType.ARID, baseHeight: 30, heightVariation: 3 },
  [BiomeId.Volcano]: { type: BiomeType.VOLCANIC, baseHeight: 60, heightVariation: 40 }
};
```

### 2. 화산 지형 생성
```typescript
// VolcanoGenerator.ts
class VolcanoGenerator {
  private volcanoes: VolcanoStructure[] = [];

  generateVolcano(x: number, z: number): VolcanoStructure {
    const radius = 40 + Math.random() * 60;      // 반경 40-100
    const height = 30 + Math.random() * 30;      // 높이 30-60
    const craterRadius = radius * 0.3;           // 분화구 반경
    const lavaDepth = 5 + Math.random() * 10;    // 용암 깊이 5-15

    const volcano = {
      center: { x, z },
      radius,
      height,
      craterRadius,
      lavaDepth
    };

    this.volcanoes.push(volcano);
    return volcano;
  }

  getVolcanoHeight(x: number, z: number): number {
    let maxHeight = 0;

    for (const volcano of this.volcanoes) {
      const distance = Math.sqrt(
        Math.pow(x - volcano.center.x, 2) +
        Math.pow(z - volcano.center.z, 2)
      );

      if (distance < volcano.radius) {
        // 원뿔 형태 높이
        const heightFraction = 1 - (distance / volcano.radius);
        const coneHeight = volcano.height * heightFraction;

        // 분화구 오목 처리
        if (distance < volcano.craterRadius) {
          const craterDepth = volcano.height * 0.3;
          const craterFraction = distance / volcano.craterRadius;
          const concaveDepth = craterDepth * (1 - craterFraction);
          maxHeight = Math.max(maxHeight, coneHeight - concaveDepth);
        } else {
          maxHeight = Math.max(maxHeight, coneHeight);
        }
      }
    }

    return maxHeight;
  }

  isInCrater(x: number, z: number): boolean {
    for (const volcano of this.volcanoes) {
      const distance = Math.sqrt(
        Math.pow(x - volcano.center.x, 2) +
        Math.pow(z - volcano.center.z, 2)
      );

      if (distance < volcano.craterRadius) {
        return true;
      }
    }

    return false;
  }
}
```

### 3. TerrainGenerator 통합
```typescript
// TerrainGenerator.ts
class TerrainGenerator {
  private volcanoGenerator = new VolcanoGenerator();

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);

    // 1. 기본 노이즈 지형
    const baseNoise = this.simplexNoise.sample2D(
      chunkX * 0.01,
      chunkZ * 0.01
    );
    const baseHeight = 20 + baseNoise * 10;

    // 2. 온도 노이즈 (화산 영역 감지)
    const temperatureNoise = this.temperatureNoise.sample2D(
      chunkX * 0.005,
      chunkZ * 0.005
    );

    // 3. 바이옴 결정
    let biomeId = BiomeId.Plains;

    if (temperatureNoise > 0.7) {
      // 화산 영역
      biomeId = BiomeId.Volcano;

      // 화산 생성 (각 청크 당 5% 확률)
      if (Math.random() < 0.05) {
        this.volcanoGenerator.generateVolcano(
          chunkX * 16 + Math.random() * 16,
          chunkZ * 16 + Math.random() * 16
        );
      }
    } else if (temperatureNoise > 0.3) {
      // 사막 영역
      biomeId = BiomeId.Desert;
    } else {
      // 평원/숲 영역
      const humidityNoise = this.humidityNoise.sample2D(
        chunkX * 0.01,
        chunkZ * 0.01
      );
      biomeId = humidityNoise > 0.5 ? BiomeId.Forest : BiomeId.Plains;
    }

    // 4. 높이 계산
    let height = baseHeight;

    if (biomeId === BiomeId.Volcano) {
      const volcanoHeight = this.volcanoGenerator.getVolcanoHeight(
        chunkX * 16,
        chunkZ * 16
      );
      height = Math.max(height, volcanoHeight);
    }

    // 5. 청크 채우기
    for (let y = 0; y < 64; y++) {
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          const worldX = chunkX * 16 + x;
          const worldZ = chunkZ * 16 + z;

          // 화산 높이 확인
          const volcanoH = this.volcanoGenerator.getVolcanoHeight(worldX, worldZ);
          const finalHeight = Math.max(height, volcanoH);

          if (y < finalHeight - 3) {
            // 기반암 (Stone)
            chunk.setBlock(x, y, z, BlockId.Stone);
          } else if (y < finalHeight) {
            // 표면 (바이옴별)
            if (biomeId === BiomeId.Volcano) {
              // 현무암 (어두운 돌)
              chunk.setBlock(x, y, z, BlockId.Basalt);
            } else if (biomeId === BiomeId.Desert) {
              chunk.setBlock(x, y, z, BlockId.Sand);
            } else {
              chunk.setBlock(x, y, z, BlockId.Grass);
            }
          } else {
            // 공기 또는 용암
            if (biomeId === BiomeId.Volcano && this.volcanoGenerator.isInCrater(worldX, worldZ)) {
              // 분화구 용암
              const volcano = this.volcanoes.find(v =>
                this.volcanoGenerator.isInCrater(worldX, worldZ)
              );

              if (volcano && y < finalHeight + volcano.lavaDepth) {
                chunk.setBlock(x, y, z, BlockId.Lava);
              } else {
                chunk.setBlock(x, y, z, BlockId.Air);
              }
            } else {
              chunk.setBlock(x, y, z, BlockId.Air);
            }
          }
        }
      }
    }

    return chunk;
  }
}
```

### 4. 용암 블록 정의
```typescript
// Block.ts
const LAVA_BLOCK: LavaBlock = {
  id: BlockId.Lava,
  level: 0,
  flowing: false,
  temperature: 1200,  // 1200°C
  color: 0xFF4500,    // 빨간색-오렌지색
  opacity: 0.8,       // 반투명
  lightLevel: 15      // 발광 (최대 밝기)
};

function createLavaBlock(level: number = 0): LavaBlock {
  return {
    ...LAVA_BLOCK,
    level: level % 8,  // 0-7
    flowing: level > 0
  };
}
```

### 5. 용암 액체 시뮬레이션
```typescript
// LavaFluid.ts
class LavaFluid {
  update(world: World, deltaTime: number): void {
    for (const [pos, block] of world.getBlocks(BlockId.Lava)) {
      if (block.flowing) {
        this.updateFlowingLava(world, pos, deltaTime);
      } else {
        this.updateStaticLava(world, pos, deltaTime);
      }
    }
  }

  updateStaticLava(world: World, pos: Vector3, deltaTime: number): void {
    // 아래로 흐름
    const belowPos = pos.clone().add(new Vector3(0, -1, 0));
    const belowBlock = world.getBlock(belowPos);

    if (belowBlock === BlockId.Air || belowBlock === BlockId.Water) {
      // 아래가 비어있으면 흐름
      world.setBlock(belowPos, createLavaBlock(1));
      world.setBlock(pos, createLavaBlock(1));  // 원래 위치도 흐름 상태로
    } else {
      // 옆으로 흐름 (느름)
      this.spreadHorizontally(world, pos, deltaTime, 0.01);  // 물보다 느림 (0.01)
    }
  }

  updateFlowingLava(world: World, pos: Vector3, deltaTime: number): void {
    // 레벨 감소
    const block = world.getBlock(pos) as LavaBlock;
    const newLevel = block.level + deltaTime * 0.5;  // 레벨 증가 (느르게)

    if (newLevel >= 8) {
      // 완전히 흐르면 제거
      world.setBlock(pos, BlockId.Air);
    } else {
      // 레벨 업데이트
      world.setBlock(pos, createLavaBlock(Math.floor(newLevel)));
    }
  }

  spreadHorizontally(world: World, pos: Vector3, deltaTime: number, spreadRate: number): void {
    const directions = [
      new Vector3(1, 0, 0),
      new Vector3(-1, 0, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 0, -1)
    ];

    for (const dir of directions) {
      const neighborPos = pos.clone().add(dir);
      const neighborBlock = world.getBlock(neighborPos);

      if (neighborBlock === BlockId.Air || neighborBlock === BlockId.Water) {
        // 옆이 비어있으면 흐름
        if (Math.random() < spreadRate * deltaTime) {
          world.setBlock(neighborPos, createLavaBlock(1));
        }
      }
    }
  }
}
```

### 6. 용암 데미지 처리
```typescript
// Player.ts
class Player extends Entity {
  private lavaDamageTimer = 0;
  private lavaDamageInterval = 1.0;  // 1초마다 데미지

  update(deltaTime: number): void {
    super.update(deltaTime);

    // 용암 데미지 체크
    this.checkLavaDamage(deltaTime);
  }

  checkLavaDamage(deltaTime: number): void {
    const currentBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z)
    );

    if (currentBlock === BlockId.Lava) {
      this.lavaDamageTimer += deltaTime;

      if (this.lavaDamageTimer >= this.lavaDamageInterval) {
        this.takeLavaDamage();
        this.lavaDamageTimer = 0;
      }
    } else {
      this.lavaDamageTimer = 0;
    }
  }

  takeLavaDamage(): void {
    const damage = 4;  // 4 데미지
    this.survival.takeDamage(damage, {
      source: 'lava',
      bypassArmor: false
    });
  }
}

// Survival.ts
class Survival {
  takeDamage(damage: number, source: DamageSource): void {
    if (source.bypassArmor) {
      this.health -= damage;
    } else {
      const armorRating = this.player.calculateTotalArmorRating();
      const reducedDamage = applyArmorReduction(damage, armorRating);
      this.health -= reducedDamage;
    }

    // 용암은 갑옷 효과 50% 감소
    if (source.source === 'lava') {
      const additionalDamage = damage * 0.5;  // 갑옷 미반응 데미지
      this.health -= additionalDamage;
    }

    // 사망 체크
    if (this.health <= 0) {
      this.die(source);
    }
  }
}
```

## 충돌/의존성

### 충돌 포인트
- **TerrainGenerator**: 기존 바이옴 시스템에 화산 통합
- **Biome**: 바이옴 ID 추가
- **Block**: 용암 블록 ID 추가
- **Player**: 용암 데미지 처리
- **Survival**: 데미지 계산 수정

### 의존성
- `SimplexNoise`: 온도/습도 노이즈
- `World`: 용암 액체 업데이트
- `Entity`: 플레이어 데미지 처리

## 테스트 방법

### 단위 테스트
1. **화산 높이**: 원뿔 형태 높이 계산 검증
2. **용암 흐름**: 수평/수직 흐름 속도 확인
3. **데미지**: 용암 접촉 시 데미지 계산

### 통합 테스트
1. **화산 생성**: 청크 생성 시 화산 배치 확인
2. **분화구**: 정상에 용암 호수 확인
3. **현무암**: 주변 지형 색상 확인
4. **플레이어 데미지**: 용암에 닿을 때 데미지 적용
5. **발광**: 용암 밝기 확인

### 엣지 케이스
- 여러 화산이 겹칠 때 처리
- 용암이 물과 만날 때 증기 효과
- 플레이어가 용암에 빠졌을 때 빠져나오기
- 청크 로드 시 용암 상태 유지
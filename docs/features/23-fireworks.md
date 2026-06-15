# 폭죽 (Fireworks) 기능 설계

## 개요
사용 시 위로 발사되어 1.5초 후 폭발하는 폭죽 아이템을 구현합니다. 폭발 시 다색 파티클이 방사형으로 분사하며, 색상과 크기는 랜덤입니다. 2초 동안 페이드아웃됩니다. 폭죽 아이템 BlockId.Firework=273으로 할당됩니다.

## 구현 범위
- 폭죽 아이템 (Firework=273)
- FireworkEntity (상승 후 폭발)
- ParticleManager에 spawnFireworkExplosion 메서드
- 폭발 효과음 (발사음 + 폭발음)
- 랜덤 색상/크기 파티클
- 2초 페이드아웃 애니메이션

## 수정 대상 파일
- `BlockId.ts`: Firework=273 추가
- `Entity.ts`: FireworkEntity 클래스
- `EntityManager.ts`: 폭죽 스폰/관리
- `Game.ts`: 폭죽 사용 로직 추가
- `ParticleManager.ts`: spawnFireworkExplosion 메서드
- `AudioManager.ts`: 폭죽 효과음 추가

## 추가 파일
- `FireworkEntity.ts`: 폭죽 Entity
  ```typescript
  class FireworkEntity extends Entity {
    private explodeTime: number;
    private startTime: number;
    private color: number;
    private particleCount: number;

    constructor(x, y, z) {
      super(x, y, z);
      this.startTime = performance.now() / 1000;
      this.explodeTime = 1.5; // 1.5초 후 폭발
      this.color = randomColor();
      this.particleCount = 30 + Math.random() * 20; // 30-50개
    }

    update(deltaTime: number, world): void {
      const elapsed = performance.now() / 1000 - this.startTime;

      if (elapsed < this.explodeTime) {
        // 상승
        this.velocity.y = 15; // 상승 속도
      } else if (elapsed < this.explodeTime + 2) {
        // 폭발
        this.explode(world);
      } else {
        // 소멸
        world.entityManager.despawnEntity(this.id);
      }
    }

    explode(world): void {
      world.particleManager.spawnFireworkExplosion(
        this.position,
        this.color,
        this.particleCount
      );

      world.audioManager.playSound('firework_explode');
      world.spawnParticles(this.position, 'SPARK');
    }
  }
  ```

## 데이터 구조
- `FireworkEntity.explodeTime`: number - 폭발 시간 (1.5초)
- `FireworkEntity.startTime`: number - 시작 시간
- `FireworkEntity.color`: number - 파티클 색상 (0xFFFFFF)
- `FireworkEntity.particleCount`: number - 파티클 개수 (30-50)
```typescript
// 의사 코드
class FireworkEntity extends Entity {
  explodeTime: number = 1.5;
  startTime: number;
  color: number;
  particleCount: number;
  exploded: boolean = false;

  constructor(x, y, z) {
    super(x, y, z);
    this.startTime = performance.now() / 1000;
    this.color = randomColor();
    this.particleCount = 30 + Math.floor(Math.random() * 20); // 30-50
    this.velocity.y = 15; // 상승 속도
  }

  update(deltaTime: number, world): void {
    const elapsed = performance.now() / 1000 - this.startTime;

    if (elapsed < this.explodeTime) {
      // 상승
      this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    } else if (!this.exploded) {
      // 폭발
      this.explode(world);
      this.exploded = true;
    } else if (elapsed >= this.explodeTime + 2) {
      // 소멸
      world.entityManager.despawnEntity(this.id);
    }
  }

  explode(world): void {
    world.particleManager.spawnFireworkExplosion(
      this.position,
      this.color,
      this.particleCount
    );

    world.audioManager.playSound('firework_explode');
  }
}
```

## 핵심 로직
1. 폭죽 사용:
```typescript
function onFireworkUse(player, world, entityManager): void {
  const heldItem = player.inventory.getSlot(player.heldSlot);

  if (heldItem && heldItem.itemId === BlockId.Firework) {
    // 플레이어 위치 위에 폭죽 스폰
    const spawnPos = player.position.clone();
    spawnPos.y += 1.5;

    const firework = new FireworkEntity(
      spawnPos.x,
      spawnPos.y,
      spawnPos.z
    );

    entityManager.addEntity(firework);
    world.audioManager.playSound('firework_launch');

    // 아이템 소비
    player.inventory.setItemAtSlot(player.heldSlot, {
      ...heldItem,
      count: heldItem.count - 1,
    });
  }
}
```

2. 폭죽 폭발 파티클:
```typescript
function spawnFireworkExplosion(position: Vector3, color: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const particle = {
      position: position.clone(),
      velocity: new Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
      color: color,
      size: 0.1 + Math.random() * 0.2,
      alpha: 1.0,
      life: 2.0, // 2초 생존
      decay: 0.5, // 초당 페이드아웃
    };

    this.particles.push(particle);
  }
}

function updateFireworkParticles(deltaTime: number): void {
  for (let i = this.particles.length - 1; i >= 0; i--) {
    const particle = this.particles[i];

    // 위치 업데이트
    particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

    // 중력
    particle.velocity.y -= 9.8 * deltaTime;

    // 공기 저항
    particle.velocity.multiplyScalar(0.98);

    // 페이드아웃
    particle.alpha -= particle.decay * deltaTime;

    if (particle.alpha <= 0) {
      this.particles.splice(i, 1);
    }
  }
}
```

3. 폭죽 렌더링:
```typescript
function renderFireworkParticles(renderer, camera): void {
  for (const particle of this.particles) {
    const geometry = new BufferGeometry();
    const vertices = new Float32Array([particle.position.x, particle.position.y, particle.position.z]);
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));

    const material = new PointsMaterial({
      color: particle.color,
      size: particle.size,
      transparent: true,
      opacity: particle.alpha,
      blending: AdditiveBlending,
    });

    const points = new Points(geometry, material);
    renderer.render(points, camera);
  }
}
```

4. 랜덤 색상:
```typescript
function randomColor(): number {
  const colors = [
    0xFF0000, // Red
    0x00FF00, // Green
    0x0000FF, // Blue
    0xFFFF00, // Yellow
    0xFF00FF, // Magenta
    0x00FFFF, // Cyan
    0xFFFFFF, // White
    0xFFA500, // Orange
    0xFFC0CB, // Pink
    0x800080, // Purple
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}
```

5. 효과음:
```typescript
class AudioManager {
  playFireworkLaunch(): void {
    this.playSound('firework_launch', 0.5, 1.0); // 쉬익
  }

  playFireworkExplode(): void {
    this.playSound('firework_explode', 0.8, 1.2); // 펑
  }
}
```

6. 폭죽 레시피:
```typescript
const FIREWORK_RECIPE = {
  pattern: [
    ['G', 'G', 'G'],
    ['G', 'P', 'G'],
    ['G', 'G', 'G'],
  ],
  key: {
    'G': ItemId.Gunpowder,
    'P': ItemId.Paper,
  },
  result: { itemId: 273, count: 3 },
};
```

## 충돌/의존성
- EntityManager와 Entity 시스템 의존
- ParticleManager와 파티클 시스템 의존
- AudioManager와 효과음 시스템 의존
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 폭죽 레시피 테스트: Gunpowder + Paper으로 폭죽 제작 확인
2. 폭죽 발사 테스트: 폭죽 사용 시 상승 후 폭발 확인
3. 폭발 파티클 테스트: 30-50개 파티클 방사형 분사 확인
4. 색상 테스트: 랜덤 색상 올바르게 적용되는지 확인
5. 페이드아웃 테스트: 2초 동안 부드럽게 사라지는지 확인
6. 효과음 테스트: 발사음 + 폭발음 올바르게 재생되는지确认
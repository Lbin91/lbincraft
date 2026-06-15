# 갈고리 (Grappling Hook) 기능 설계

## 개요
사용 시 플레이어를 타겟 블록 방향으로 끌어당기는 갈고리 아이템을 구현합니다. 레이캐스트로 타겟을 확인하며, 사거리 20블록 내에서 사용 가능합니다. 쿨다운 2초가 적용됩니다. BlockId.GrapplingHook=269로 할당됩니다.

## 구현 범위
- 갈고리 아이템 (GrapplingHook=269)
- 레이캐스트로 타겟 블록 확인
- 플레이어 끌어당기기 물리 (velocity 조절)
- 사거리 제한 (20블록)
- 쿨다운 시스템 (2초)
- 갈고리 시각 효과 (선 렌더링)
- 갈고리 레시피 (IronIngot 3 + Stick 2 + String)

## 수정 대상 파일
- `BlockId.ts`: GrapplingHook=269, String=270 추가
- `Game.ts`: onMouseDown에 갈고리 사용 로직 추가
- `Controls.ts`: 쿨다운 추적 (lastGrapplingHookUse)
- `PlayerView.ts`: 갈고리 선 렌더링
- `Recipe.ts`: 갈고리 레시피 추가

## 추가 파일
- `GrapplingHook.ts`: 갈고리 로직 클래스
  ```typescript
  class GrapplingHook {
    private cooldown: number = 0;
    private target: { x, y, z } | null = null;

    use(world, player, controls): boolean {
      if (this.cooldown > 0) return false;

      const target = this.raycast(world, player.position, player.direction);
      if (target && target.distance <= 20) {
        this.target = target.position;
        this.applyForce(player, target.position);
        this.cooldown = 2; // 2초 쿨다운
        return true;
      }

      return false;
    }

    update(deltaTime: number): void {
      this.cooldown -= deltaTime;
    }
  }
  ```

## 데이터 구조
- `Controls.lastGrapplingHookUse`: number - 마지막 사용 시간
- 플레이어 물리 업데이트 시 velocity 조절
```typescript
// 의사 코드
class Player {
  position: Vector3;
  velocity: Vector3;
}

class GrapplingHook {
  cooldown: number = 0;
  target: Vector3 | null = null;
  hookLine: Line | null = null;

  raycast(world, position: Vector3, direction: Vector3): { position: Vector3, distance: number } | null {
    const raycaster = new Raycaster(position, direction);
    raycaster.far = 20;

    const intersections = raycaster.intersectObjects(world.meshes);

    if (intersections.length > 0) {
      const hit = intersections[0];
      return {
        position: hit.point,
        distance: hit.distance,
      };
    }

    return null;
  }

  applyForce(player: Player, target: Vector3): void {
    const direction = target.clone().sub(player.position).normalize();
    const speed = 15; // 끌어당기는 속도

    // 중력 유지
    player.velocity.x = direction.x * speed;
    player.velocity.z = direction.z * speed;
    player.velocity.y = Math.max(player.velocity.y, 5); // 최소 상승력
  }

  update(deltaTime: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    if (this.target && this.cooldown <= 0) {
      this.target = null;
      if (this.hookLine) {
        this.hookLine.visible = false;
      }
    }
  }

  render(playerPosition: Vector3): void {
    if (this.target) {
      if (!this.hookLine) {
        this.hookLine = createLine(playerPosition, this.target, '#888888');
      } else {
        this.hookLine.geometry.setFromPoints([playerPosition, this.target]);
      }
      this.hookLine.visible = true;
    }
  }
}
```

## 핵심 로직
1. 갈고리 사용:
```typescript
function onGrapplingHookUse(game, player): void {
  const hook = player.gaplingHook;
  const now = performance.now() / 1000;

  if (now - game.controls.lastGrapplingHookUse < 2) {
    game.uiManager.showMessage("아직 사용할 수 없습니다.");
    return;
  }

  const success = hook.use(game.world, player, game.controls);

  if (success) {
    game.controls.lastGrapplingHookUse = now;
    game.audioManager.playSound('grappling_hook_use');
  }
}
```

2. 플레이어 물리 업데이트:
```typescript
function updatePlayerPhysics(player, deltaTime: number): void {
  // 중력
  player.velocity.y -= 9.8 * deltaTime;

  // 갈고리 끌어당기기
  if (player.grapplingHook.target) {
    player.grapplingHook.applyForce(player, player.grapplingHook.target);
  }

  // 위치 업데이트
  player.position.add(player.velocity.clone().multiplyScalar(deltaTime));

  // 충돌 감지
  const collision = detectCollision(player.position, player.velocity, world);
  if (collision) {
    handleCollision(player, collision);
  }

  // 갈고리 업데이트
  player.grapplingHook.update(deltaTime);
}
```

3. 갈고리 선 렌더링:
```typescript
function createLine(start: Vector3, end: Vector3, color: string): Line {
  const geometry = new BufferGeometry().setFromPoints([start, end]);
  const material = new LineBasicMaterial({ color: color, linewidth: 2 });
  return new Line(geometry, material);
}

function renderGrapplingHookLine(player, scene): void {
  player.grapplingHook.render(player.position);

  if (player.grapplingHook.hookLine) {
    if (!scene.getObjectById(player.grapplingHook.hookLine.id)) {
      scene.add(player.grapplingHook.hookLine);
    }
  }
}
```

4. 레시피:
```typescript
const GRAPPLING_HOOK_RECIPE = {
  pattern: [
    ['I', 'S', 'I'],
    ['S', ' ', ' '],
    [' ', ' ', ' '],
  ],
  key: {
    'I': ItemId.IronIngot,
    'S': ItemId.Stick,
    'T': ItemId.String,
  },
  result: { itemId: 269, count: 1 },
};
```

## 충돌/의존성
- 플레이어 물리 시스템과 연동 필요
- 쿨다운 시스템과 연동 필요
- 레이캐스트와 충돌 시스템 의존
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 갈고리 레시피 테스트: IronIngot 3 + Stick 2 + String으로 제작 확인
2. 타겟 감지 테스트: 20블록 내 타겟 올바르게 감지되는지 확인
3. 끌어당기기 테스트: 타겟 방향으로 플레이어가 끌려가는지 확인
4. 쿨다운 테스트: 2초 쿨다운 올바르게 적용되는지 확인
5. 사거리 테스트: 20블록 초과 시 사용 불가 확인
6. 시각 효과 테스트: 갈고리 선 올바르게 렌더링되는지 확인
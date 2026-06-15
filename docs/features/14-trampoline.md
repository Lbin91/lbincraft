# 트램펄린 블록 구현 설계

## 개요

트램펄린 블록은 플레이어가 착지 시 위쪽으로 강력한 튕김 효과를 제공하는 기능 블록입니다. 밝은 분홍색 상단면과 짙은 분홍색 측면/하단면을 가지며, 플레이어가 떨어져 착지할 때 수직 속도를 20m/s로 반전시켜 높이 점프를 가능하게 합니다. 낙하 데미지 면제 기능도 제공하여 높은 곳에서 안전하게 착지할 수 있습니다.

## 구현 범위

- BlockId 열거형에 Trampoline 블록 추가 (ID=16)
- BlockType 인터페이스에 트램펄린 속성 정의
- Physics.ts의 moveAxis('y') 충돌 감지 로직 수정
- 트램펄린 충돌 시 velocity 반전 및 가속
- 낙하 데미지 면제 (fallPeakY 리셋)
- 트램펄린 제작 레시피 구현

## 수정 대상 파일

### 1. `BlockId.ts`
```
enum BlockId {
    Air = 0,
    Grass = 1,
    Dirt = 2,
    Stone = 3,
    Wood = 4,
    Leaves = 5,
    Sand = 6,
    Water = 7,
    CoalOre = 8,
    IronOre = 9,
    GoldOre = 10,
    DiamondOre = 11,
    Bedrock = 12,
    Wool = 13,
    Clay = 14,
    Glass = 15,
    Trampoline = 16,    // 신규 추가
}
```

### 2. `BlockDefinitions.ts`
```
const TRAMPOLINE_BLOCK: BlockType = {
    id: BlockId.Trampoline,
    name: 'Trampoline',
    transparent: false,
    solid: true,
    breakable: true,
    affectedByGravity: false,
    colors: {
        top: [1.0, 0.267, 0.667],    // #ff44aa 밝은 분홍
        bottom: [0.667, 0.133, 0.4],  // #aa2266 짙은 분홍
        side: [0.667, 0.133, 0.4],
    },
};

// 블록 등록 테이블에 추가
BLOCK_REGISTRY[BlockId.Trampoline] = TRAMPOLINE_BLOCK;
```

### 3. `Physics.ts`
```
const GRAVITY = -30;
const BOUNCE_VELOCITY = 20;  // 트램펄린 튕김 속도 (기본 점프 9의 약 2.2배)
const EPSILON = 0.001;

class Physics {
    private player: Player;
    private fallPeakY: number;  // 낙하 시작 Y 좌표

    update(deltaTime: number) {
        this.applyGravity(deltaTime);
        this.handleCollisions();
    }

    applyGravity(deltaTime: number) {
        this.player.velocity.y += GRAVITY * deltaTime;

        // 낙하 시작 Y 좌표 기록
        if (this.player.velocity.y < 0 && this.player.onGround === false) {
            if (this.fallPeakY === undefined || this.player.position.y > this.fallPeakY) {
                this.fallPeakY = this.player.position.y;
            }
        }
    }

    handleCollisions() {
        // X, Y, Z 축별 충돌 감지
        this.moveAxis('x');
        this.moveAxis('z');
        this.moveAxis('y');  // 트램펄린 로직 포함
    }

    moveAxis(axis: 'x' | 'y' | 'z') {
        const oldPos = this.player.position.clone();
        const oldVel = this.player.velocity.clone();

        // 축별 이동
        if (axis === 'x') {
            this.player.position.x += this.player.velocity.x * this.deltaTime;
        } else if (axis === 'y') {
            this.player.position.y += this.player.velocity.y * this.deltaTime;
        } else if (axis === 'z') {
            this.player.position.z += this.player.velocity.z * this.deltaTime;
        }

        // AABB 충돌 감지
        const collision = this.checkAABBCollision(this.player);

        if (collision) {
            // Y축 충돌 시 트램펄린 확인
            if (axis === 'y' && this.player.velocity.y < 0) {
                const blockBelow = this.getBlockAt(
                    Math.floor(this.player.position.x),
                    Math.floor(this.player.position.y - 0.1),  // 바닥 블록 확인
                    Math.floor(this.player.position.z)
                );

                if (blockBelow && blockBelow.id === BlockId.Trampoline) {
                    // 트램펄린 튕김 효과
                    this.player.velocity.y = BOUNCE_VELOCITY;
                    this.player.position.y = oldPos.y;  // 충돌 위치로 복귀

                    // 낙하 데미지 면제
                    this.fallPeakY = undefined;

                    // 사운드 재생
                    AudioManager.play('trampoline-bounce');

                    return;
                }
            }

            // 일반 충돌: 위치 복귀 및 속도 0 설정
            this.player.position = oldPos;
            this.player.velocity[axis] = 0;

            // 낙하 데미지 적용 (Y축 충돌 시)
            if (axis === 'y' && this.player.velocity.y < 0) {
                this.applyFallDamage();
            }
        }
    }

    applyFallDamage() {
        if (this.fallPeakY === undefined) {
            return;
        }

        const fallDistance = this.fallPeakY - this.player.position.y;

        // 3블록 이상 낙하 시 데미지
        if (fallDistance > 3) {
            const damage = Math.floor((fallDistance - 3) * 2);  // 1블록당 2 데미지
            this.player.takeDamage(damage);
        }

        this.fallPeakY = undefined;
    }

    checkAABBCollision(entity: Entity): Collision | null {
        // 기존 AABB 충돌 감지 로직
        // World.isSolidAt() 사용하여 블록 충돌 확인

        // 생략 (기존 코드 유지)
        return null;
    }

    getBlockAt(x: number, y: number, z: number): BlockType | null {
        const blockId = World.getBlock(x, y, z);
        if (blockId === BlockId.Air) {
            return null;
        }
        return BLOCK_REGISTRY[blockId];
    }
}
```

### 4. `Crafting.ts`
```
// 트램펄린 제작 레시피 (Wool + Stick 중앙)
CRAFTING_RECIPES.push({
    pattern: [
        'WSW',
        'S S',
        'WSW',
    ],
    key: {
        'W': { itemId: 260, count: 1 },  // Wool (가정, BlockId 13)
        'S': { itemId: 259, count: 1 },  // Stick (Items 259)
    },
    output: { itemId: 16, count: 1 },    // Trampoline (BlockId)
    recipeType: 'shaped',
});
```

## 추가 파일

없음 (기존 파일만 수정)

## 데이터 구조

### Physics 상태
```
interface PhysicsState {
    player: Player;
    deltaTime: number;
    fallPeakY?: number;      // 낙하 시작 Y 좌표
    onGround: boolean;
}
```

### 충돌 감지 결과
```
interface Collision {
    axis: 'x' | 'y' | 'z';
    block: BlockType;
    position: Vector3;
    normal: Vector3;
}
```

## 핵심 로직

### 트램펄린 튕김 로직
```
function handleTrampolineBounce(player: Player, position: Vector3): void {
    // 플레이어가 아래로 이동 중인지 확인
    if (player.velocity.y >= 0) {
        return;  // 위로 이동 중이면 튕김 효과 없음
    }

    // 바닥 블록 확인
    const blockBelow = Physics.getBlockAt(
        Math.floor(position.x),
        Math.floor(position.y - 0.1),  // 플레이어 하단
        Math.floor(position.z)
    );

    if (blockBelow && blockBelow.id === BlockId.Trampoline) {
        // 튕김 효과 적용
        player.velocity.y = BOUNCE_VELOCITY;  // 20m/s

        // 낙하 데미지 면제
        Physics.fallPeakY = undefined;

        // 사운드
        AudioManager.play('trampoline-bounce');

        // 파티클 효과
        ParticleSystem.spawnTrampolineParticles(position);
    }
}
```

### 트램펄린 제작 로직
```
function craftTrampoline(grid: ItemStack[][]): ItemStack | null {
    const trampolineRecipe = {
        pattern: [
            'WSW',
            'S S',
            'WSW',
        ],
        key: {
            'W': { itemId: 260, count: 1 },  // Wool
            'S': { itemId: 259, count: 1 },  // Stick
        },
        output: { itemId: 16, count: 1 },
    };

    const result = matchShapedRecipe(grid, trampolineRecipe);

    if (!result) {
        return null;
    }

    // 재료 소비 (Wool 4개, Stick 4개)
    consumeRecipeItems(grid, trampolineRecipe);

    // 결과 아이템 반환
    return {
        itemId: result.itemId,
        count: result.count,
    };
}
```

### 낙하 데미지 면제 로직
```
function resetFallDamage() {
    // 트램펄린에 착지 시 fallPeakY 리셋
    Physics.fallPeakY = undefined;

    // 플레이어가 트램펄린 위에 있는지 주기적으로 확인
    setInterval(() => {
        const blockBelow = Physics.getBlockAt(
            Math.floor(player.position.x),
            Math.floor(player.position.y - 0.1),
            Math.floor(player.position.z)
        );

        if (blockBelow && blockBelow.id === BlockId.Trampoline) {
            Physics.fallPeakY = undefined;
        }
    }, 100);
}
```

## 충돌/의존성

### 의존성
- `BlockId.ts`: 트램펄린 블록 ID 정의
- `BlockDefinitions.ts`: 트램펄린 속성 정의
- `Physics.ts`: 충돌 감지, 튕김 로직, 낙하 데미지 계산
- `World.ts`: 블록 조회
- `AudioManager.ts`: 튕김 사운드 재생
- `Crafting.ts`: 제작 레시피 매칭

### 잠재적 충돌

1. **Physics moveAxis 로직 복잡성**
   - 문제: 트램펄린 충돌 로직이 기존 충돌 처리와 섞일 수 있음
   - 해결: 충돌 타입을 분류하여 처리 순서 명확화

2. **높은 위치에서 튕김 시 중력**
   - 문제: 튕김 후 중력으로 다시 빠르게 낙하 가능
   - 해결: BOUNCE_VELOCITY 충분히 높게 설정 (20m/s)

3. **연속 트램펄린 튕김**
   - 문제: 플레이어가 트램펄린 위에 계속 있으면 무한 튕김 가능
   - 해결: 특정 속도 이상일 때만 튕김 허용

4. **AABB 충돌 감지 오류**
   - 문제: EPSILON=0.001로 인해 트램펄린 상단 감지 실패 가능
   - 해결: 바닥 블록 확인 시 y-0.1 오프셋 사용

5. **멀티플레이어 동기화**
   - 문제: 튕김 효과가 다른 플레이어에게 올바르게 전송되지 않을 수 있음
   - 해결: NetworkSync에 튕김 이벤트 전송 로직 추가

## 테스트 방법

### 1. 기능 테스트

```
테스트 1: 트램펄린 배치
- 트램펄린 아이템 선택
- 빈 공간에 우클릭
- 결과: 트램펄린 블록 배치됨, 색상 확인 (상단 밝은 분홍)

테스트 2: 낮은 곳에서 튕김
- 트램펄린 위에 서서 점프
- 결과: 기본 점프와 동일하게 동작 (튕김 효과 없음)

테스트 3: 높은 곳에서 튕김
- 5블록 높이에서 트램펄린으로 낙하
- 결과: 플레이어가 20m/s 속도로 위로 튕어오름

테스트 4: 낙하 데미지 면제
- 10블록 높이에서 트램펄린으로 낙하
- 결과: 낙하 데미지 0 (일반 땅에 착지 시 데미지 14)

테스트 5: 연속 튕김
- 첫 튕김 후 다시 트램펄린으로 낙하
- 결과: 매번 튕김 효과 적용됨
```

### 2. 물리 테스트

```
테스트 6: 최대 튕김 높이 측정
- 트램펄린에서 튕겨 나갈 때 최대 도달 높이 측정
- 예상: 20m/s 속도로 약 6.7m 상승 (v² = 2gh)
- 결과: 물리 시뮬레이션과 일치

테스트 7: 수평 이동 중 튕김
- 달리는 중 트램펄린에 착지
- 결과: 수평 속도 유지, 수직 속도만 반전

테스트 8: 수직 벽 충돌과 튕김 동시
- 트램펄린 옆에 벽 세우고 높이에서 낙하
- 결과: 벽 충돌 후 바닥 튕김 효과 적용됨
```

### 3. 경계 테스트

```
테스트 9: 극단적 높이에서 낙하
- 50블록 높이에서 트램펄린으로 낙하
- 결과: 튕김 효과 적용, 데미지 없음

테스트 10: 트램펄린 위에 다른 블록 배치
- 트램펄린 상단에 흙 블록 배치
- 위에서 낙하
- 결과: 흙 블록 착지 (트램펄린 효과 없음)

테스트 11: 트램펄린 하단 충돌
- 트램펄린 하단으로 위로 점프
- 결과: 일반 블록처럼 충돌, 튕김 효과 없음
```

### 4. 크래프팅 테스트

```
테스트 12: 올바른 레시피
- Wool 4개, Stick 4개로 패턴 배치
- 결과: 트램펄린 생성됨

테스트 13: 잘못된 레시피
- 중앙 Stick 없이 배치
- 결과: 트램펄린 생성되지 않음

테스트 14: 레시피 회전
- 패턴을 90도 회전하여 배치
- 결과: 생성되지 않음 (shaped 레시피)
```

### 5. 성능 테스트

```
테스트 15: 대량 트램펄린 렌더링
- 100개 트램펄린 배치
- FPS 모니터링
- 결과: 성능 저하 없음

테스트 16: 빠른 연속 튕김
- 매 프레임 트램펄린에 착지하는 상황 시뮬레이션
- 결과: 물리 시뮬레이션 안정
```

### 6. 사운드 테스트

```
테스트 17: 튕김 사운드 재생
- 트램펄린에 착지
- 결과: "boing" 사운드 재생됨

테스트 18: 연속 튕김 사운드
- 5회 연속 튕김
- 결과: 매번 사운드 재생됨, 중복 방지 필요
```
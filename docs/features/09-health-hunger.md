# Feature 09: Health/Hunger Survival System

> 난이도: ⭐⭐⭐ Large | 예상 시간: 4시간

## 개요

플레이어에게 체력과 허기 수치를 추가하여 생존 압박감을 만드는 시스템. 낙하 데미지, 허기 소모, 음식 섭취, 사망/리스폰 등 마인크래프트 크리에이티브 모드를 서바이벌 모드로 전환.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 게임 시작 시 | 체력 10칸(=20), 허기 10칸(=20) |
| S2 | 이동/점프/파괴 시 | 허기가 천천히 감소 |
| S3 | 허기가 0이 되면 | 체력이 서서히 감소 |
| S4 | 높은 곳에서 떨어지면 | 낙하 데미지로 체력 감소 |
| S5 | 음식(사과 등)을 먹으면 | 허기 회복 |
| S6 | 체력이 0이 되면 | 사망 → 리스폰 (스폰 위치로) |
| S7 | 수영 중 | 산소 게이지 표시, 0이 되면 데미지 |

## 기술 설계

### 신규 파일
- `src/player/Survival.ts` — 체력/허기/산소 상태 관리
- `src/player/DamageSource.ts` — 데미지 소스 정의 (낙하, 허기, 음수)

### 수정 파일
- `src/player/Player.ts` — survival 상태 추가
- `src/player/Physics.ts` — 낙하 데미지 계산 (낙하 거리 추적)
- `src/engine/Game.ts` — 허기 감소, 산소 체크, 사망 처리
- `index.html` — 체력/허기/산소 UI (하트, 닭다리, 거품)
- `src/main.ts` — UI 업데이트 연동

### 데이터 구조

```typescript
// Survival.ts
class Survival {
    health: number = 20;       // 0~20 (10 하트, 각 2점)
    maxHealth: number = 20;
    hunger: number = 20;       // 0~20 (10 닭다리)
    maxHunger: number = 20;
    oxygen: number = 10;       // 0~10 (수영 중 게이지)
    maxOxygen: number = 10;
    saturation: number = 5;    // 허기 감소 속도 조절 (숨겨진 값)

    isDead: boolean = false;
    private fallDistance: number = 0;  // 누적 낙하 거리

    takeDamage(amount: number, source: DamageSource): void;
    heal(amount: number): void;
    eat(food: FoodItem): void;
    consumeHunger(amount: number): void;

    update(delta: number, player: Player, world: World): void;
}

// DamageSource.ts
enum DamageSource {
    Fall = 'fall',
    Starvation = 'starvation',
    Drowning = 'drowning',
    // Phase 2: Mob, Fire, Lava
}

// FoodItem (향후 크래프팅/파밍과 연동)
interface FoodItem {
    blockId: BlockId;
    hungerRestore: number;
    saturationRestore: number;
}
```

### 로직 (★ Oracle 검토 반영: 물 감지 + Y기반 낙하 추정)

```
물 감지 (★ Oracle 검토 반영):
  // 플레이어 눈높이 블록이 물인지 확인
  const eyeBlock = world.getBlock(
      floor(player.position.x),
      floor(player.position.y + 0.9),
      floor(player.position.z)
  );
  const inWater = (eyeBlock === BlockId.Water);

  // 물 속에서 중력 감소 (부력 시뮬레이션)
  if (inWater):
    player.velocity.y = max(player.velocity.y - 3 * delta, -3)  // 느린 침강
    // Space키로 상승
    if controls.isJumping():
      player.velocity.y = 4  // 수영 상승

낙하 거리 추적 (★ Y 위치 기반으로 변경 — 기존 velocity 방식은 서브스텝으로 깨짐):
  if player.onGround:
    if fallPeakY - player.position.y > 3:  // 3블록 이상 낙하
      damage = floor(fallPeakY - player.position.y - 3)
      survival.takeDamage(damage, DamageSource.Fall)
    fallPeakY = player.position.y
  else:
    fallPeakY = max(fallPeakY, player.position.y)

Survival.update(delta):
  // 허기 자연 소모 (이동 시)
  if player is moving:
    saturation -= 0.02 * delta
  if saturation <= 0:
    hunger -= 0.01 * delta

  // 허기 0 시 체력 감소
  if hunger <= 0:
    health -= 1 * delta  // 1초당 1점
    health = max(0, health)

  // 허기 충분하면 자연 회복
  if hunger >= 18 && health < maxHealth:
    health += 0.5 * delta  // 2초당 1점 회복
    hunger -= 0.1 * delta  // 회복 시 허기 소모

  // 수영 중 산소 소모
  if player is in water:
    oxygen -= delta
    if oxygen <= 0:
      takeDamage(1, DamageSource.Drowning)
  else:
    oxygen = maxOxygen  // 수영 안 하면 회복

  // 사망 체크
  if health <= 0 && !isDead:
    onDeath()
```

### UI 구조

```
┌──────────────────────────────────┐
│ ❤❤❤❤❤❤❤❤❤❤  (10 하트)       │
│ 🍗🍗🍗🍗🍗🍗🍗🍗🍗🍗 (10 닭다리)   │
│              ◌◌ (산소 게이지, 수영 중만)│
└──────────────────────────────────┘

하트: 빨간색 하트 (반 하트 = 회전된 하트)
닭다리: 갈색 아이콘
산소: 파란 거품 게이지
```

### 음식 소스 (초기)

| 음식 | 획득 방법 | 허기 회복 |
|------|----------|----------|
| 사과 | 나무 잎 파괴 시 5% 확률 드롭 | 4 |
| 생고기 | 동물 처치 (Feature 10 필요) | 3 |
| 구운 고기 | 화로에서 생고기 제련 | 8 |

## 의존성
- 없음 (독립 가능하지만, 음식 획득은 Feature 07 인벤토리, Feature 10 동물과 연동)

## 성공 기준

- [ ] 체력/허기 UI가 표시된다
- [ ] 이동/활동 시 허기가 감소한다
- [ ] 낙하 데미지가 작동한다 (3블록 이상)
- [ ] 허기 0 시 체력이 감소한다
- [ ] 음식 섭취 시 허기가 회복된다
- [ ] 체력 0 시 사망 → 리스폰한다
- [ ] 수영 중 산소 게이지 + 익사 데미지
- [ ] 하트/닭다리 UI가 실시간 업데이트된다

## 검증 방법

1. UI에서 하트/닭다리 표시 확인
2. 높은 곳에서 뛰어내려 낙하 데미지 확인
3. 가만히 있어서 허기 감소 → 체력 감소 확인
4. 사과(나무 잎) 획득 → 섭취 → 허기 회복 확인
5. 체력 0 → 사망 → 리스폰 확인

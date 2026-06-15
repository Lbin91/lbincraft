# Feature 11: 슈퍼맨 모드 (Superman Mode)

> 난이도: ⭐⭐⭐ Medium | 예상 시간: 3시간  
> "G키 한 번으로 하늘을 날아라!"

---

## 1. 개요

슈퍼맨 모드는 플레이어가 하늘을 자유롭게 날아다닐 수 있는 치트/장난 기능이다. 중력을 무시하고 3차원 공간을 누비며, 지상에서는 절대 볼 수 없는 각도에서 자신의 건축물을 감상하거나, 먼 거리를 순식간에 이동할 수 있다.

서바이벌 밸런스를 완전히 파괴하지만, 그게 바로 재미의 포인트다. 초등학생이 친구들한테 "나 하늘 날 수 있어!"라고 자랑하고 싶은 기능.

### 왜 재밌는가

- **시야의 자유**: 땅에 묶이지 않고 어디든 갈 수 있는 해방감
- **건축 감상**: 지어놓은 성을 위에서 내려다보는 쾌감
- **이동 효율**: 산 하나 넘는데 3초면 충분
- **치트의 짜릿함**: "이러면 안 되는데..." 하는 죄책감이 주는 재미

---

## 2. 조작법

### 활성화 / 비활성화

| 조작 | 동작 |
|------|------|
| `G` 키 (토글) | 슈퍼맨 모드 ON / OFF |
| 더블 점프 (Space 두 번) | 대안 발동 방식 (선택 사항) |

- `G`키를 누르면 즉시 중력이 사라지고 제자리에 떠오른다
- 다시 `G`키를 누르면 중력이 복구되어 떨어지기 시작한다

### 비행 중 조작

| 조작 | 동작 |
|------|------|
| `W A S D` | 수평 이동 (바라보는 방향 기준) |
| `Space` | 상승 |
| `Shift` | 하강 |
| `Mouse` | 시선 방향 (비행 방향 결정) |
| `W` + `Ctrl` | 부스트 (3배 속도, 스태미나 없음) |

### 속도 단계

| 상태 | 속도 |
|------|------|
| 일반 걷기 (비행 아님) | 5.5 m/s (기존) |
| 비행 기본 | 15 m/s (약 3배) |
| 비행 부스트 (Ctrl) | 45 m/s (약 8배) |

---

## 3. 물리 변화

### 중력

```
isFlying = true 일 때:
  - gravity 적용 안 함 (velocity.y += 0)
  - 대신 Space/Shift 입력으로 y 속도 직접 제어
  - velocity.y = (space ? 15 : 0) + (shift ? -15 : 0)
```

### 충돌 처리

- **기본**: 블록 충돌 유지 (벽 통과 불가)
- 블록 안으로 들어가려 하면 벽에 막힘
- 이탈 시 자동으로 경계로 보정

### 낙하 데미지

- 슈퍼맨 모드 활성 중: 낙하 데미지 **면역**
- 모드 해제 후 추락 시: 기존 낙하 데미지 정상 적용
- 단, 모드 해제 직후의 낙하는 면역 (해제 시점의 fallPeakY 리셋)

### 이동 속도

```
const FLY_SPEED = 15;      // m/s
const FLY_BOOST_SPEED = 45; // m/s (Ctrl)

if (isFlying) {
    player.velocity.x = lookDir.x * speed;
    player.velocity.y = verticalInput * speed;  // Space/Shift
    player.velocity.z = lookDir.z * speed;
}
```

---

## 4. 시각 효과

### 비행 속도선 (Speed Lines)

비행 속도에 비례하여 화면 가장자리에 흰색 선이 나타난다.

```
구현 방법:
  - Three.js LineSegments를 카메라 자식으로 추가
  - 10~15개의 수직/수평 선을 화면 모서리에 배치
  - 투명도(opacity) = currentSpeed / FLY_BOOST_SPEED
  - 속도가 낮으면 안 보이고, 부스트 시 선명하게
```

### 3인칭 비행 자세

3인칭 모드에서 플레이어 모델이 수평 자세를 취한다.

```
if (isFlying && playerView.mode === ThirdPerson):
  bodyGroup.rotation.x = -Math.PI / 2  // 수평 눕기
  leftArm.rotation.x = -Math.PI / 2     // 앞으로 뻗기
  rightArm.rotation.x = -Math.PI / 2
  // 슈퍼맨 클래식 포즈: 양팔 앞으로 쭉
```

### 활성화 / 비활성화 전환 애니메이션

- **ON**: 플레이어가 0.5초간 위로 살짝 떠오르며 모드 진입 (ease-out)
- **OFF**: 0.3초간 자연스럽게 하강 자세로 복귀

---

## 5. 사운드 효과

절차적 Web Audio API로 합성 (외부 파일 없음).

### 비행 윙윙음

```
구현 (AudioManager.ts):
  - OscillatorNode: type = 'sawtooth'
  - 주파수: baseFreq = 80Hz + speed * 5Hz (속도 비례)
  - GainNode: gain = 0.02 (낮은 볼륨)
  - LowpassFilter: frequency = 400Hz (웅움거리는 느낌)
  - LFO: 주파수 2Hz, depth 10Hz (미세 진동으로 바람 소리 표현)
```

### 발동 / 해제 효과음

- **ON**: 짧은 상승 음 (200Hz → 800Hz, 0.3초 sine ramp)
- **OFF**: 짧은 하강 음 (800Hz → 200Hz, 0.3초 sine ramp)

---

## 6. UI 표시

### 화면 배지

슈퍼맨 모드 활성 시 화면 상단 중앙에 배지 표시.

```
┌──────────────────────────────────┐
│                                  │
│       🦸 SUPERMAN MODE           │  ← 활성 시 표시
│                                  │
│         (게임 화면)               │
│                                  │
└──────────────────────────────────┘
```

```typescript
// main.ts에서 관리
const badge = document.createElement('div');
badge.id = 'superman-badge';
badge.style.cssText = `
    position: absolute;
    top: 10px; left: 50%;
    transform: translateX(-50%);
    background: rgba(50, 100, 200, 0.8);
    color: #ffdd00;
    padding: 4px 16px;
    border-radius: 4px;
    font-size: 0.85rem;
    z-index: 60;
    display: none;
`;
badge.textContent = '🦸 SUPERMAN MODE';
```

### ESC 메뉴 추가

기존 overlay의 "카메라 / 저장" 섹션 아래에 추가:

```
슈퍼맨 모드
G       슈퍼맨 모드 ON/OFF (비행)
Ctrl    비행 부스트 (3배속)
```

---

## 7. 기술 고려사항

### Player.ts

```typescript
// 추가 프로퍼티
isFlying: boolean = false;
flySpeed: number = 15;

// 비행 시 onGround 항상 false
```

### Physics.ts

```typescript
update(player, moveDir, delta):
  if (player.isFlying):
    player.velocity.x = moveDir.x * FLY_SPEED;
    player.velocity.z = moveDir.z * FLY_SPEED;
    player.velocity.y = 0;  // 초기화
    if (space) player.velocity.y += FLY_SPEED;
    if (shift) player.velocity.y -= FLY_SPEED;
    // 중력 스킵
    // 충돌 처리는 유지 (벽 통과 방지)
    player.onGround = false;
    return;  // 일반 물리 로직 스킵
  else:
    // 기존 물리 로직
```

### Controls.ts

```typescript
// 추가 입력 감지
isAscending(): boolean  // Space (비행 중 상승)
isDescending(): boolean // Shift (비행 중 하강)
isBoosting(): boolean   // Ctrl (부스트)

consumeToggleFly(): boolean  // G키 소비
```

### PlayerView.ts

```typescript
update(delta, player):
  // 기존 로직...
  if (player.isFlying):
    // 비행 자세 적용
    bodyGroup.rotation.x = -Math.PI / 2;
    arms forward;
    // 속도선 효과 표시
    speedLines.visible = true;
    speedLines.material.opacity = speed / FLY_BOOST_SPEED;
  else:
    // 일반 자세
    bodyGroup.rotation.x = 0;
    speedLines.visible = false;
```

### Survival.ts

```typescript
// 낙하 데미지 추적
if (player.isFlying):
  fallPeakY = player.position.y;  // 계속 리셋
  // 모드 해제 시 새로운 낙하 시작점
```

---

## 8. 크리에이티브 모드와의 관계

### 현재 상황

- LbinCraft는 **서바이벌 전용** 게임이다
- 크리에이티브 모드 (무한 블록, 비행, 무적)는 없다
- 인벤토리는 비어있는 상태로 시작, 블록을 채굴해야 획득

### 슈퍼맨 모드의 위치

- **치트 / 장난 기능**으로 분류
- 밸런스를 깨지만 토글 한 번으로 ON/OFF 가능
- "비행하면서 블록 파괴/설치"는 그대로 가능
- 게임 시작부터 사용 가능 (별도 해금 조건 없음)

### 향후 확장 가능성

- 크리에이티브 모드가 추가될 경우, 슈퍼맨 모드는 크리에이티브의 비행 기능으로 흡수 가능
- 또는 슈퍼맨 모드를 크리에이티브 전용으로 이관
- 현재는 독립적인 치트 기능으로 구현

---

## 성공 기준

- [ ] `G`키로 비행 ON/OFF가 토글된다
- [ ] 비행 중 WASD + Space + Shift로 자유 이동이 가능하다
- [ ] `Ctrl`로 부스트 속도가 발동한다
- [ ] 비행 중 낙하 데미지를 받지 않는다
- [ ] 3인칭에서 수평 비행 자세가 표시된다
- [ ] 비행 윙윙음이 발생한다
- [ ] 화면 상단에 "🦸 SUPERMAN MODE" 배지가 표시된다
- [ ] ESC 메뉴에 조작법이 추가된다
- [ ] 60fps 유지 (비행 중 성능 저하 없음)

## 검증 방법

1. 게임 실행 → `G`키 → 공중에 떠오르는지 확인
2. WASD + 마우스로 사방향 이동 확인
3. Space/Shift로 상승/하강 확인
4. 고층에서 `G`해제 → 낙하 데미지 확인 (비행 중 낙하 데미지 0)
5. `F`키 3인칭 → 수평 자세 확인
6. `Ctrl`부스트 → 속도선 효과 확인

---

*작성일: 2026-06-15*

# Feature 03: Day/Night Cycle

> 난이도: ⭐ Small | 예상 시간: 1시간

## 개요

태양이 천천히 회전하며 하늘이 낮에서 밤으로 변하는 사이클. 밤에는 어두워지고 별이 보이며, 전체적인 분위기가 극적으로 변함.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 게임 시작 시 | 낮으로 시작 (밝은 하늘, 태양 높이) |
| S2 | 시간이 지나면 | 태양이 서서히 이동, 하늘색이 주황→남색으로 변화 |
| S3 | 태양이 지평선 아래로 | 밤이 됨 (어두운 하늘, 조명 약화, 별 visible) |
| S4 | 다시 낮이 되면 | 원래 밝기로 복귀 |
| S5 | 전체 사이클 | 10분 (낮 7분, 밤 3분) |

## 기술 설계

### 신규 파일
- `src/engine/DayNightCycle.ts` — 시간 진행, 태양/조명/하늘 색상 관리

### 수정 파일
- `src/engine/Game.ts` — DayNightCycle 인스턴스 보유, animate에서 update 호출
- `src/engine/Game.ts` — 기존 ambient/directional light를 DayNightCycle이 관리하도록 이관

### 데이터 구조

```typescript
class DayNightCycle {
    private sun: THREE.DirectionalLight;
    private ambient: THREE.AmbientLight;
    private scene: THREE.Scene;

    private time: number = 0;           // 0.0 ~ 1.0 (하루)
    private dayDuration: number = 600;   // 10분 (초)

    // 하늘 색상 키프레임
    private skyColors: { time: number; color: THREE.Color }[] = [
        { time: 0.0,  color: 0x0a0a30 },  // 한밤중 (짙은 남색)
        { time: 0.2,  color: 0xFF6B35 },  // 일출 (주황)
        { time: 0.3,  color: 0x87CEEB },  // 아침 (하늘색)
        { time: 0.5,  color: 0x87CEEB },  // 정오 (하늘색)
        { time: 0.7,  color: 0xFF8C42 },  // 일몰 (주황)
        { time: 0.8,  color: 0x4B0082 },  //黄昏 (보라)
        { time: 0.9,  color: 0x0a0a30 },  // 밤
        { time: 1.0,  color: 0x0a0a30 },  // 한밤중
    ];

    update(delta: number): void;
    private interpolateSkyColor(time: number): THREE.Color;
    private updateSunPosition(time: number): void;
    private updateLightIntensity(time: number): void;
}
```

### 로직

```
update(delta):
  1. time += delta / dayDuration
  2. time > 1.0 이면 time -= 1.0 (래핑)

  3. 태양 위치 계산:
     sunAngle = time * Math.PI * 2 - Math.PI / 2  // -π/2에서 시작 (동쪽 지평선)
     sun.position.set(
         Math.cos(sunAngle) * 100,    // X
         Math.sin(sunAngle) * 100,    // Y (음수면 지평선 아래)
         50                             // Z (고정)
     )

  4. 조명 강도 계산:
     sunHeight = Math.max(0, Math.sin(sunAngle))  // 0~1
     sun.intensity = sunHeight * 0.8
     ambient.intensity = 0.2 + sunHeight * 0.4

  5. 하늘색 Lerp:
     현재 time에 해당하는 색상을 키프레임에서 보간
     scene.background = interpolatedColor
     scene.fog.color = interpolatedColor
```

### 태양/달 시각화 (선택)

```typescript
// 태양: 밝은 노란 구체
private sunMesh: THREE.Mesh;  // SphereGeometry, MeshBasicMaterial(0xFFFF99)

// 위치는 directional light와 동일하게
```

## 의존성
- 없음

## 성공 기준

- [ ] 시간이 지남에 따라 하늘색이 변한다
- [ ] 태양(조명)이 회전하며 밝기가 변한다
- [ ] 밤에는 화면이 어두워진다
- [ ] 10분 주기로 낮/밤이 순환한다
- [ ] 색상 전환이 부드럽다 (급변 없음)
- [ ] FPS에 영향이 없다

## 검증 방법

1. 게임 실행 후 시간 경과에 따른 하늘색 변화 관찰
2. `game.dayNight.time = 0.5` (정오) / `0.0` (한밤중)로 설정하여 즉시 전환 확인
3. FPS 카운터로 성능 확인

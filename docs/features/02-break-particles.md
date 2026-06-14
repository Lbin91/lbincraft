# Feature 02: Break Particle Effects

> 난이도: ⭐ Small | 예상 시간: 45분

## 개요

블록을 부술 때 해당 블록의 색상을 가진 작은 파티클(조각)들이 튀어오르며 사라지는 효과. 타격감과 시각적 피드백 제공.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 플레이어가 블록을 부순다 | 블록 색상의 작은 큐브 8~12개가 위로 튀며 중력으로 떨어지고 페이드아웃 |
| S2 | 연속으로 블록을 부순다 | 각 파괴마다 독립적인 파티클 생성 |
| S3 | 파티클이 1초 후 | 자동으로 사라짐 (메모리 누수 방지) |
| S4 | 파티클 생성 중 60FPS 유지 | 성능 저하 없음 |

## 기술 설계

### 신규 파일
- `src/effects/ParticleManager.ts` — 파티클 생성/업데이트/제거 관리

### 수정 파일
- `src/engine/Game.ts` — ParticleManager 인스턴스 보유, breakBlock에서 호출

### 데이터 구조

```typescript
interface Particle {
    mesh: THREE.Mesh;          // 작은 큐브 (0.15 크기)
    velocity: THREE.Vector3;   // 초기 속도 (위쪽 + 랜덤 방향)
    life: number;              // 남은 수명 (초)
    maxLife: number;           // 전체 수명 (1.0초)
}

class ParticleManager {
    private particles: Particle[] = [];
    private scene: THREE.Scene;
    private sharedGeometry: THREE.BoxGeometry;  // 0.15x0.15x0.15 재사용

    spawnBlockBreak(position: THREE.Vector3, color: string): void;
    update(delta: number): void;  // 중력 적용, 위치 갱신, 수명 감소, 페이드아웃, 제거
}
```

### 로직

```
블록 파괴 시:
  1. 블록의 중심 위치 계산 (blockX + 0.5, blockY + 0.5, blockZ + 0.5)
  2. 블록 타입의 상단 색상 가져오기
  3. 8~12개의 파티클 생성:
     - 위치: 블록 중심 ± 0.3 랜덤 오프셋
     - 속도: 위쪽(0, 3~5, 0) + 수평 랜덤(-1~1, 0, -1~1)
     - 색상: 블록 색상
     - 크기: 0.1~0.2 랜덤
  4. 파티클을 scene에 추가

매 프레임 (update):
  1. 각 파티클에 중력(-15 m/s²) 적용
  2. 위치 갱신: position += velocity * delta
  3. 수명 감소: life -= delta
  4. 페이드아웃: material.opacity = life / maxLife
  5. life <= 0이면 scene에서 제거, geometry/material dispose, 배열에서 삭제
```

### 성능 고려사항

- Geometry 공유 (하나의 BoxGeometry를 모든 파티클이 재사용, 각자 Material)
- 최대 파티클 수 제한 (예: 200개 초과 시 가장 오래된 것 제거)
- 각 파티클은 독립 Mesh (인스턴싱은 오버엔지니어링, 파티클 수가 적음)

## 의존성
- 없음 (독립 구현 가능)

## 성공 기준

- [ ] 블록 파괴 시 파티클이 생성된다
- [ ] 파티클이 위로 튀었다가 중력으로 떨어진다
- [ ] 1초 후 페이드아웃되며 사라진다
- [ ] 연속 파괴 시 각각 독립 동작한다
- [ ] 60FPS 유지된다
- [ ] 메모리 누수가 없다 (파티클 제거 시 dispose)

## 검증 방법

1. 브라우저에서 블록 파괴 → 파티클 효과 확인
2. 연속 10개 블록 파괴 → FPS 저하 없는지 확인
3. 5초 대기 후 → 파티클이 모두 사라졌는지 확인

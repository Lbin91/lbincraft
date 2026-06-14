# Feature 01: Block Highlight Outline

> 난이도: ⭐ Small | 예상 시간: 30분

## 개요

플레이어가 바라보는 블록에 검은색 테두리(Wireframe)를 표시하여, 어떤 블록을 조작할지 명확히 보여주는 기능.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 플레이어가 블록을 바라본다 | 해당 블록에 검은 테두리 박스 표시 |
| S2 | 플레이어가 시선을 돌리면 | 이전 블록의 테두리 사라지고 새 블록에 표시 |
| S3 | 바라보는 곳에 블록이 없으면 (하늘 등) | 테두리 미표시 |
| S4 | 사거리(6블록) 밖의 블록을 바라보면 | 테두리 미표시 |

## 기술 설계

### 신규 파일
- 없음 (기존 Game.ts에 통합)

### 수정 파일
- `src/engine/Game.ts`
  - `BlockHighlight` wireframe mesh 추가
  - 매 프레임 raycast 수행 → 결과에 따라 하이라이트 박스 위치 갱신

### 데이터 구조

```typescript
// Game 클래스 내부
private blockHighlight: THREE.LineSegments;

// 초기화: EdgesGeometry로 큐브 테두리 생성
const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const edges = new THREE.EdgesGeometry(boxGeo);
this.blockHighlight = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
);
this.scene.add(this.blockHighlight);
```

### 로직

```typescript
// animate() 내부, 렌더 직전
const eyePos = this.player.getEyePosition();
const dir = this.player.getLookDirection();
const result = raycastVoxel(eyePos, dir, 6, this.world);

if (result.hit) {
    this.blockHighlight.visible = true;
    this.blockHighlight.position.set(
        result.block.x + 0.5,
        result.block.y + 0.5,
        result.block.z + 0.5
    );
} else {
    this.blockHighlight.visible = false;
}
```

## 성공 기준

- [x] 바라보는 블록에 테두리가 표시된다
- [x] 시선 이동 시 테두리가 실시간으로 따라간다
- [x] 사거리 밖 또는 블록 없을 시 표시되지 않는다
- [x] FPS에 영향이 없다 (raycast는 이미 break/place에서 사용 중)

## 검증 방법

1. 브라우저에서 게임 실행
2. 블록을 바라보며 테두리가 나타나는지 확인
- 시선 회전 시 테두리가 새 블록으로 이동하는지 확인
- 하늘을 바라보면 테두리가 사라지는지 확인

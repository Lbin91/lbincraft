# 문 (Door) 기능 설계

## 개요
2블록 높이의 회전 가능한 문 블록을 구현합니다. 문은 열림/닫힘 상태를 가지며, 클릭 시 상태가 전환됩니다. BlockId.Door=17로 할당되며, 방향(facing)에 따라 회전 축이 결정됩니다.

## 구현 범위
- 문 블록 모델 및 텍스처
- 상태 저장을 위한 블록 상태 시스템 도입
- 클릭 시 열림/닫힘 전환 로직
- 부드러운 회전 애니메이션 (lerp)
- 문 레시피 (Wood 6개, 2x3 패턴)

## 수정 대상 파일
- `Game.ts`: onMouseDown에 문 클릭 처리 로직 추가
- `World.ts`: blockStates Map<"x,y,z", BlockState> 추가
- `MeshBuilder.ts`: 문 블록의 상태에 따른 메시 생성
- `Recipe.ts`: 문 레시피 추가
- `BlockId.ts`: Door=17 추가

## 추가 파일
- `BlockState.ts`: 블록 상태 인터페이스 정의
  ```typescript
  interface BlockState {
    open: boolean;
    facing: number; // 0=북, 1=동, 2=남, 3=서
  }
  ```

## 데이터 구조
- `World.blockStates`: Map<"x,y,z", BlockState>
- 문 블록 배치 시 상위/하위 블록의 상태 동기화
```typescript
// 의사 코드
interface BlockState {
  open: boolean;
  facing: number;
}

class World {
  blockStates: Map<string, BlockState> = new Map();

  getBlockState(x, y, z): BlockState | undefined {
    return this.blockStates.get(`${x},${y},${z}`);
  }

  setBlockState(x, y, z, state: BlockState): void {
    this.blockStates.set(`${x},${y},${z}`, state);
  }
}
```

## 핵심 로직
1. 문 배치 시:
```typescript
function placeDoor(world, x, y, z, facing): void {
  // 하위 블록 배치
  world.setBlock(x, y, z, BlockId.Door);
  world.setBlockState(x, y, z, { open: false, facing });

  // 상위 블록 배치 (상태 공유)
  world.setBlock(x, y + 1, z, BlockId.Door);
  world.setBlockState(x, y + 1, z, { open: false, facing });
}
```

2. 문 클릭 시:
```typescript
function toggleDoor(world, x, y, z): void {
  const state = world.getBlockState(x, y, z);
  if (state) {
    state.open = !state.open;

    // 하위 블록 찾기
    const lowerY = world.getBlock(x, y - 1, z) === BlockId.Door ? y - 1 : y;
    world.setBlockState(x, lowerY, z, state);
    world.setBlockState(x, lowerY + 1, z, state);
  }
}
```

3. 애니메이션 렌더링:
```typescript
function renderDoor(mesh, state, deltaTime): void {
  const targetRotation = state.open ? Math.PI / 2 : 0;
  mesh.rotation.y = lerp(mesh.rotation.y, targetRotation, deltaTime * 5);
}
```

## 충돌/의존성
- World.modificationMap과 blockStates의 동기화 필요
- 충돌 시스템: 열린 문은 충돌박스 조절 필요
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 문 레시피 테스트: Wood 6개로 문 제작 확인
2. 문 배치 테스트: 하위/상위 블록이 올바르게 배치되는지 확인
3. 회전 테스트: 4방향에서 올바른 회전 축 확인
4. 열림/닫힘 테스트: 클릭 시 부드러운 전환 확인
5. 충돌 테스트: 열린 문에서 플레이어 통과 가능 여부 확인
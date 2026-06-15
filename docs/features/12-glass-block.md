# 유리(Glass) 블록 구현 설계

## 개요

유리 블록은 반투명하고 채광 가능한 블록으로, 모래(Sand)를 크래프팅하여 제작합니다. 빛은 통과하지만 플레이어 통과는 불가능한 불투명 블록입니다. 시각적으로는 연한 하늘색을 띠며, 반투명 효과를 통해 뒤쪽 블록이 흐릿하게 보입니다.

## 구현 범위

- BlockId 열거형에 Glass 블록 추가 (ID=15)
- BlockType 인터페이스에 유리 속성 정의
- 모래에서 유리로 변환하는 크래프팅 레시피 구현
- MeshBuilder에서 투명 블록 렌더링 지원
- 반투명 색상 적용 (R200, G230, B240)

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
    Glass = 15,      // 신규 추가
}
```

### 2. `BlockDefinitions.ts`
```
const GLASS_BLOCK: BlockType = {
    id: BlockId.Glass,
    name: 'Glass',
    transparent: true,
    solid: true,
    breakable: true,
    affectedByGravity: false,
    colors: {
        top: [0.79, 0.90, 0.94],    // #c8e6f0
        bottom: [0.79, 0.90, 0.94],
        side: [0.79, 0.90, 0.94],
    },
};

// 블록 등록 테이블에 추가
BLOCK_REGISTRY[BlockId.Glass] = GLASS_BLOCK;
```

### 3. `Crafting.ts`
```
// shapeless recipe: Sand -> Glass
CRAFTING_RECIPES.push({
    input: [
        { itemId: 6, count: 1 },  // Sand
    ],
    output: { itemId: 15, count: 1 },  // Glass
    recipeType: 'shapeless',
});
```

### 4. `MeshBuilder.ts`
```
// 기존 코드에서 투명 블록 분리 로직 유지
function buildChunkMesh(chunk: Chunk) {
    const opaqueFaces = [];
    const transparentFaces = [];

    for (let block of chunk.blocks) {
        const blockType = BLOCK_REGISTRY[block.typeId];

        if (blockType.transparent) {
            // 유리 블록은 transparent mesh에 포함
            collectFaces(block, transparentFaces);
        } else {
            collectFaces(block, opaqueFaces);
        }
    }

    return {
        opaque: createGeometry(opaqueFaces),
        transparent: createGeometry(transparentFaces),
    };
}
```

## 추가 파일

없음 (기존 파일만 수정)

## 데이터 구조

### BlockType 인터페이스 확장
```
interface BlockType {
    id: number;
    name: string;
    transparent: boolean;    // true: 유리
    solid: boolean;          // true: 충돌 있음
    breakable: boolean;      // true: 부술 수 있음
    affectedByGravity: boolean;
    colors: {
        top: [number, number, number];
        bottom: [number, number, number];
        side: [number, number, number];
    };
}
```

### CraftingRecipe 인터페이스
```
interface CraftingRecipe {
    input: Array<{ itemId: number, count: number }>;
    output: { itemId: number, count: number };
    recipeType: 'shaped' | 'shapeless';
}
```

## 핵심 로직

### 유리 블록 생성 로직
```
function craftGlass(inventorySlots: ItemStack[]): ItemStack | null {
    // 인벤토리에서 모래 1개 찾기
    const sandIndex = findItem(inventorySlots, BlockId.Sand);

    if (sandIndex === -1) {
        return null;  // 모래 없음
    }

    // 모래 1개 소비
    inventorySlots[sandIndex].count -= 1;
    if (inventorySlots[sandIndex].count === 0) {
        inventorySlots[sandIndex] = null;
    }

    // 유리 블록 1개 생성
    return {
        itemId: BlockId.Glass,
        count: 1,
    };
}
```

### 유리 블록 배치 로직
```
function placeGlassBlock(player: Player, targetPosition: Vector3): boolean {
    const blockType = BLOCK_REGISTRY[BlockId.Glass];

    // Physics.ts에서 충돌 체크
    if (isSolidAt(targetPosition)) {
        return false;  // 이미 블록 있음
    }

    // World.ts에 블록 설정
    World.setBlock(targetPosition.x, targetPosition.y, targetPosition.z, BlockId.Glass);

    // MeshBuilder에 청크 재생성 요청
    MeshBuilder.markChunkDirty(getChunkPosition(targetPosition));

    return true;
}
```

### 유리 블록 파괴 로직
```
function breakGlassBlock(position: Vector3): void {
    const blockId = World.getBlock(position);

    if (blockId !== BlockId.Glass) {
        return;  // 유리가 아님
    }

    // World에서 블록 제거
    World.setBlock(position.x, position.y, position.z, BlockId.Air);

    // 아이템 드롭 (유리 1개)
    Inventory.addItem(BlockId.Glass, 1);

    // Mesh 청크 재생성
    MeshBuilder.markChunkDirty(getChunkPosition(position));
}
```

## 충돌/의존성

### 의존성
- `BlockId.ts`: 기존 열거형 확장
- `BlockDefinitions.ts`: 유리 블록 속성 정의
- `Crafting.ts`: 크래프팅 시스템 의존
- `MeshBuilder.ts`: 투명 블록 렌더링 파이프라인 사용
- `World.ts`: 블록 설정/삭제 API 사용
- `Physics.ts`: 충돌 감지 로직 (solid=true)

### 잠재적 충돌
- **MeshBuilder 렌더링 순서**: 투명 블록은 불투명 블록 뒤에 렌더링되어야 함
  - 해결: buildChunkMesh()에서 두 개의 별도 메시 생성 후 렌더링 순서 보장

- **Face Culling**: 유리 블록 뒤쪽 면도 렌더링해야 함
  - 해결: 투명 블록은 항상 6면 모두 렌더링

- **조명 계산**: 반투명 블록은 다른 블록 조명에 영향
  - 해결: 유리 블록 주변 블록의 조명 값을 그대로 통과

## 테스트 방법

### 1. 기능 테스트

```
테스트 1: 모래에서 유리 크래프팅
- 모래 블록 획득 (Sand)
- 인벤토리에서 크래프팅 그리드에 모두 배치
- 결과: 유리 블록 1개 생성 확인

테스트 2: 유리 블록 배치
- 유리 블록 선택
- 빈 공간에 우클릭
- 결과: 유리 블록 배치됨

테스트 3: 유리 블록 통과 불가
- 유리 블록 앞에서 이동 시도
- 결과: 충돌 감지, 통과 불가

테스트 4: 유리 블록 부수기
- 유리 블록에 좌클릭
- 결과: 유리 블록 파괴, 인벤토리에 유리 아이템 추가

테스트 5: 투명성 시각 확인
- 유리 블록 배치 후 뒤쪽 블록 관찰
- 결과: 뒤쪽 블록이 흐릿하게 보임
```

### 2. 성능 테스트

```
테스트 6: 대량 유리 블록 렌더링
- 100개 이상 유리 블록 배치
- FPS 모니터링
- 결과: 투명 메시 분리로 성능 저하 없음
```

### 3. 물리 테스트

```
테스트 7: 유리 블록 위에 서기
- 유리 블록 위로 점프
- 결과: 정상적으로 서 있음

테스트 8: 유리 블록 통과 시도
- 유리 블록 방향으로 대시
- 결과: 충돌 감지, 속도 0으로 설정
```

### 4. 크래프팅 테스트

```
테스트 9: 모래 없는 상태에서 크래프팅
- 빈 크래프팅 그리드에서 크래프팅 시도
- 결과: 유리 생성되지 않음

테스트 10: 모래 2개 배치
- 모래 2개 배치 후 크래프팅
- 결과: 유리 1개 생성 (남은 모래 1개)
```
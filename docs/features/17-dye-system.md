# 염색 시스템 (Dye System) 기능 설계

## 개요
염색 가능한 블록(Wool)과 염료 아이템을 도입하여 블록의 색상을 커스터마이징합니다. 꽃 블록(Flower)을 수확하여 염료를 제작할 수 있으며, 염색된 양모는 16가지 색상 변종을 가집니다.

## 구현 범위
- 꽃 블록 (Flower=18) 3종 (빨강/노랑/파랑)
- 염료 아이템 (265: RedDye, 266: YellowDye, 267: BlueDye)
- 염색 가능한 블록 (Wool=19) 16색 변종
- 블록 메시의 색상 오버라이드
- 염색 레시피 (꽃 + 양모 = 염색된 양모)

## 수정 대상 파일
- `BlockId.ts`: Flower=18, Wool=19, RedDye=265, YellowDye=266, BlueDye=267 추가
- `MeshBuilder.ts`: dyeable 블록의 dyeColor로 색상 오버라이드 로직
- `BlockType.ts`: dyeable, dyeColor 속성 추가 (또는 별도의 BlockMetadata 시스템)
- `Recipe.ts`: 꽃 제작 레시피, 염색 레시피 추가
- `Inventory.ts`: 염색 아이템 스태킹 가능

## 추가 파일
- `ColorPalette.ts`: 16색상 팔레트 정의
  ```typescript
  const COLORS = [
    0xFFFFFF, // White
    0xFFA5A5, // Red
    0xFFA5FF, // Pink
    // ... 16 colors total
  ];
  ```

## 데이터 구조
- 염색된 블록의 색상은 modification으로 저장
```typescript
// 의사 코드
interface BlockMetadata {
  dyeColor?: number; // 0-15, undefined for undyed
}

class World {
  blockMetadata: Map<string, BlockMetadata> = new Map();

  setBlockMetadata(x, y, z, metadata: BlockMetadata): void {
    this.blockMetadata.set(`${x},${y},${z}`, metadata);
  }

  getBlockMetadata(x, y, z): BlockMetadata | undefined {
    return this.blockMetadata.get(`${x},${y},${z}`);
  }
}

// 블록 타입 정의 (필요시)
const BLOCK_TYPES = {
  [BlockId.Wool]: { dyeable: true, defaultColor: 0 },
};
```

## 핵심 로직
1. 염료 제작 (꽛 → 염료):
```typescript
// 꽛 레시피
const FLOWER_RECIPES = [
  { input: BlockId.RedFlower, output: { itemId: 265, count: 1 } }, // RedDye
  { input: BlockId.YellowFlower, output: { itemId: 266, count: 1 } }, // YellowDye
  { input: BlockId.BlueFlower, output: { itemId: 267, count: 1 } }, // BlueDye
];
```

2. 양모 염색:
```typescript
function dyeWool(world, x, y, z, dyeColor: number): void {
  const currentMetadata = world.getBlockMetadata(x, y, z) || {};
  currentMetadata.dyeColor = dyeColor;
  world.setBlockMetadata(x, y, z, currentMetadata);

  // Modification으로 기록
  world.modificationMap.set(`${x},${y},${z}`, {
    blockId: BlockId.Wool,
    metadata: currentMetadata,
  });
}
```

3. MeshBuilder에서 색상 오버라이드:
```typescript
function buildBlockMesh(blockId, metadata, geometry, material): Mesh {
  const mesh = new Mesh(geometry, material);

  if (BLOCK_TYPES[blockId].dyeable && metadata?.dyeColor !== undefined) {
    const colorHex = COLORS[metadata.dyeColor];
    mesh.material.color.setHex(colorHex);
  }

  return mesh;
}
```

4. 혼합 염색 (선택):
```typescript
function mixDyes(dye1: number, dye2: number): number {
  // 색상 혼합 로직 (R + G = Yellow, etc.)
  const colorTable = {
    [0][1]: 4, // Red + Yellow = Orange
    [0][2]: 5, // Red + Blue = Purple
    [1][2]: 6, // Yellow + Blue = Green
  };
  return colorTable[dye1][dye2] || dye1;
}
```

## 충돌/의존성
- World.modificationMap과 blockMetadata의 동기화 필요
- MeshBuilder의 색상 오버라이드 로직과 충돌 방지
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 꽃 레시피 테스트: 꽛 제작 시 염료 획득 확인
2. 염색 레시피 테스트: 양모 + 염료로 염색된 양모 제작 확인
3. 색상 렌더링 테스트: 염색된 양모가 올바른 색상으로 렌더링되는지 확인
4. 혼합 염색 테스트: 두 염료 혼합 시 올바른 색상 확인
5. 저장/로드 테스트: 염색된 블록의 색상이 올바르게 저장되는지 확인
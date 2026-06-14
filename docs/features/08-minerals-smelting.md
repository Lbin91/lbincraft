# Feature 08: Minerals + Smelting

> 난이도: ⭐⭐⭐ Large | 예상 시간: 4시간

## 개요

지하에 광물(석탄, 철, 금, 다이아몬드)을 분포시키고, 화로(Furnace)에서 광석를 주괴로 제련하는 시스템. 채굴의 목적과 진행감(progression)을 제공.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 깊은 곳을 파면 | 돌 사이에 광석 블록이 섞여 있음 |
| S2 | 석탄은 얕은 곳에, 다이아몬드는 깊은 곳에 | 깊이별 광물 분포 |
| S3 | 광석을 채굴하면 | 광석 아이템 획득 (Feature 07 인벤토리 필요) |
| S4 | 화로에 광석 + 연료(석탄) 넣으면 | 시간 경과 후 주괴로 변환 |
| S5 | 주괴로 | 도구/장비 크래프팅 (확장 가능) |

## 기술 설계

### 신규 파일
- `src/blocks/OreType.ts` — 광물 정의 (블록 ID 확장)
- `src/engine/Furnace.ts` — 화로 블록 로직 (제련 타이머)
- `src/blocks/SmeltingRecipe.ts` — 제련 레시피 (광석 → 주괴)

### 수정 파일
- `src/blocks/BlockType.ts` — 새 블록 ID 추가 (CoalOre, IronOre, GoldOre, DiamondOre, Furnace)
- `src/engine/TerrainGenerator.ts` — 광물 분포 로직
- `src/engine/World.ts` — 화로 블록 업데이트 로직 (틱 기반)

### 데이터 구조

```typescript
// BlockType.ts - 새 블록 ID
export enum BlockId {
    // 기존...
    CoalOre = 9,
    IronOre = 10,
    GoldOre = 11,
    DiamondOre = 12,
    FurnaceBlock = 13,
}

// OreType.ts
interface OreDistribution {
    blockId: BlockId;
    minY: number;        // 최소 생성 높이
    maxY: number;        // 최대 생성 높이
    rarity: number;      // 생성 확률 (0~1, 돌 블록 대비)
    veinSize: number;    // 한 번에 생성되는 최대 블록 수
    drops: BlockId;      // 채굴 시 드롭 아이템
}

const ORE_DISTRIBUTIONS: OreDistribution[] = [
    { blockId: CoalOre,     minY: 5,  maxY: 30, rarity: 0.02,  veinSize: 12, drops: CoalOre },
    { blockId: IronOre,     minY: 3,  maxY: 20, rarity: 0.012, veinSize: 8,  drops: IronOre },
    { blockId: GoldOre,     minY: 1,  maxY: 10, rarity: 0.005, veinSize: 6,  drops: GoldOre },
    { blockId: DiamondOre,  minY: 1,  maxY: 6,  rarity: 0.002, veinSize: 4,  drops: DiamondOre },
];

// Furnace.ts
interface FurnaceState {
    input: ItemStack | null;   // 제련할 광석
    fuel: ItemStack | null;    // 연료 (석탄)
    output: ItemStack | null;  // 결과 주괴
    burnTime: number;          // 남은 연소 시간 (초)
    cookTime: number;          // 현재 제련 진행도 (초)
    totalCookTime: number;     // 완성까지 필요 시간 (10초)
}

// 화로 위치별 상태 저장
const furnaceStates = new Map<string, FurnaceState>(); // 키: "x,y,z"

// SmeltingRecipe.ts
const SMELTING_RECIPES: Map<BlockId, { output: BlockId; cookTime: number }> = new Map([
    [BlockId.IronOre,    { output: BlockId.IronIngot,   cookTime: 10 }],
    [BlockId.GoldOre,    { output: BlockId.GoldIngot,   cookTime: 10 }],
    [BlockId.CoalOre,    { output: BlockId.Coal,        cookTime: 5  }],
    [BlockId.Sand,       { output: BlockId.Glass,       cookTime: 5  }],
]);
```

### 광물 생성 로직 (★ Oracle 검토 반영: 결정론적 생성)

```
generateChunk(chunk):
  기존 지형 생성 후...
  for each Stone 블록 (x, y, z):
    for each ore in ORE_DISTRIBUTIONS:
      if y < ore.minY || y > ore.maxY: continue
      // 결정론적 hash 사용 (Math.random 금지 — 월드 재현성)
      const wx = chunk.cx * 16 + x
      const wz = chunk.cz * 16 + z
      const hash = ((wx * 374761393) ^ (y * 668265263) ^ (wz * 2147483647)) >>> 0
      if (hash % 10000) / 10000 < ore.rarity:
        generateOreVein(chunk, x, y, z, ore)

generateOreVein(chunk, x, y, z, ore):
  size = random(1, ore.veinSize)
  for i in 0..size:
    nx = x + random(-1, 1)
    ny = y + random(-1, 1)
    nz = z + random(-1, 1)
    if chunk.getBlock(nx, ny, nz) === Stone:  // 현재 청크 내에서만 (경계 클리핑 수용)
      chunk.setBlock(nx, ny, nz, ore.blockId)
```

### 아이템 타입 (★ Oracle 검토 반영: Feature 07 ItemId 사용)

- IronIngot, GoldIngot, Coal, Glass는 BlockId가 아닌 `ItemId` 사용
- `SMELTING_RECIPES`의 output은 `ItemId` 타입
- 화로 UI에서 ItemId 표시 (블록이 아닌 아이템 렌더링)

### 화로 제련 로직

```
Furnace.update(delta):
  1. 연료 확인:
     if burnTime > 0: burnTime -= delta
     else if fuel && input && hasRecipe(input):
       burnTime = fuelBurnTime(fuel)
       fuel.count -= 1
     else: cookTime = 0; return  // 연료 없음

  2. 제련 진행:
     if input && hasRecipe(input):
       recipe = getRecipe(input)
       cookTime += delta
       if cookTime >= recipe.cookTime:
         // 완성
         output.addItem(recipe.output, 1)
         input.count -= 1
         cookTime = 0

  3. 상태 저장
```

## 의존성
- **Feature 07 (Inventory + Crafting)**: 광석 아이템 획득, 주괴 크래프팅에 필요

## 성공 기준

- [ ] 깊이별로 광물이 분포한다 (석탄 얕음, 다이아 깊음)
- [ ] 광물이 베인(vein) 형태로 무리 지어 생성된다
- [ ] 광석을 채굴하면 아이템을 얻는다
- [ ] 화로 UI에서 제련이 가능하다
- [ ] 연료가 소모된다
- [ ] 제련 완료 시 결과물을 얻는다
- [ ] 성능에 영향이 없다

## 검증 방법

1. y=5 근처에서 채굴 → 석탄/철 발견 확인
2. y=2 근처 → 다이아몬드 발견 확인 (확률 낮음)
3. 화로 배치 → 광석 + 석탄 넣기 → 10초 후 주괴 획득

# Feature 07: Inventory + Crafting

> 난이도: ⭐⭐ Medium | 예상 시간: 3시간

## 개요

블록을 채굴하면 인벤토리에 저장되고, 모은 자원으로 새로운 블록/아이템을 제작(craft)하는 시스템. 자원 수집에 의미를 부여하고 진행감을 만듦.

## 사용자 시나리오

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| S1 | 블록을 부수면 | 인벤토리에 해당 블록 1개 추가 |
| S2 | 'E' 키를 누르면 | 인벤토리 화면 토글 (게임 일시정지) |
| S3 | 인벤토리에서 블록을 핫바로 드래그 | 핫바 슬롯에 배치 |
| S4 | 크래프팅 그리드에 재료 배치 | 레시피 매칭 시 결과 아이템 표시 |
| S5 | 크래프트 버튼 클릭 | 재료 소모, 결과 획득 |
| S6 | 같은 블록 여러 개 부수면 | 스택 카운트 증가 (최대 64) |

## 기술 설계

### 신규 파일
- `src/inventory/Inventory.ts` — 인벤토리 데이터 관리
- `src/inventory/Recipe.ts` — 크래프팅 레시피 정의
- `src/inventory/InventoryUI.ts` — DOM 기반 인벤토리 UI

### 수정 파일
- `src/engine/Game.ts` — breakBlock 시 인벤토리 추가, 'E' 키 처리
- `src/main.ts` — 인벤토리 UI 통합
- `index.html` — 인벤토리/크래프팅 오버레이 HTML/CSS

### 데이터 구조 (★ Oracle 검토 반영: ItemId 타입 시스템)

```typescript
// ItemId = BlockId의 상위집합 (블록 + 비블록 아이템)
export type ItemId = BlockId | number;  // 0-255: BlockId, 256+: Items

export const Items = {
    IronIngot: 256,
    GoldIngot: 257,
    Coal: 258,
    Apple: 259,
    Stick: 260,
} as const;

interface ItemStack {
    itemId: ItemId;       // BlockId 또는 Item ID (Oracle: blockId → itemId 확장)
    count: number;        // 최대 64
}

class Inventory {
    slots: (ItemStack | null)[];  // 27개 슬롯
    hotbar: (ItemStack | null)[]; // 9개 슬롯

    addItem(itemId: ItemId, count: number = 1): boolean;
    removeItem(itemId: ItemId, count: number = 1): boolean;
    getItemCount(itemId: ItemId): number;
}
```

### HOTBAR_BLOCKS 마이그레이션 (★ Oracle 검토 반영)

기존 `HOTBAR_BLOCKS[selectedSlot]`를 `inventory.hotbar[selectedSlot]?.itemId`로 전환:

| 파일 | 기존 코드 | 변경 후 |
|------|---------|--------|
| `Game.placeBlock` | `HOTBAR_BLOCKS[this.selectedSlot]` | `this.inventory.hotbar[this.selectedSlot]?.itemId` |
| `Game.selectSlot` | `HOTBAR_BLOCKS.length` 범위 체크 | `this.inventory.hotbar.length` |
| `main.ts setupHotbar` | `HOTBAR_BLOCKS.forEach` | `inventory.hotbar` 기반 렌더링 |
| `main.ts keyboard` | 숫자키 1-8 | `inventory.hotbar.length` 기반 |

초기 상태: 크리에이티브 모드 유지 (모든 블록 핫바에 미리 채움)

// Recipe.ts
interface Recipe {
    pattern: (BlockId | null)[][];  // 3x3 그리드 (null = 빈 칸)
    result: { blockId: BlockId; count: number };
    isShaped: boolean;  // 모양 고정 여부
}

const RECIPES: Recipe[] = [
    {
        // 돌 4개 → 코블스톤 슬래브 2개 (예시)
        pattern: [
            [Stone, null, null],
            [Stone, null, null],
            [null, null, null],
        ],
        result: { blockId: Stone, count: 2 },  // 예시
        isShaped: true,
    },
    // 나무 4개 → 합판 4개 (Wood → Planks 느낌)
    // 나무 1개 → 막대기 4개 (Stick)
];
```

### UI 구조

```
┌─────────────────────────────────────┐
│           인벤토리                    │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┬──┐       │
│ │  │  │  │  │  │  │  │  │  │ ← 27  │
│ ├──┼──┼──┼──┼──┼──┼──┼──┼──┤       │
│ │  │  │  │  │  │  │  │  │  │       │
│ ├──┼──┼──┼──┼──┼──┼──┼──┼──┤       │
│ │  │  │  │  │  │  │  │  │  │       │
│ └──┴──┴──┴──┴──┴──┴──┴──┴──┘       │
│                                     │
│    크래프팅                          │
│    ┌──┬──┬──┐    ┌──┐               │
│    │  │  │  │ →  │  │               │
│    └──┴──┴──┘    └──┘               │
│                                     │
│    핫바                              │
│    ┌──┬──┬──┬──┬──┬──┬──┬──┬──┐    │
│    │  │  │  │  │  │  │  │  │  │    │
│    └──┴──┴──┴──┴──┴──┴──┴──┴──┘    │
└─────────────────────────────────────┘
```

### 로직

```
블록 파괴 시:
  1. 기존: 블록 제거만
  2. 추가: inventory.addItem(brokenBlockId, 1)
  3. 핫바의 해당 슬롯 카운트 업데이트

블록 설치 시:
  1. 핫바에서 해당 블록 count 감소
  2. count === 0이면 슬롯 null

'E' 키 토글:
  1. 인벤토리 UI 표시/숨김
  2. Pointer Lock 해제 (일시정지)
  3. 다시 누르면 인벤토리 닫고 Pointer Lock 재활성화

크래프팅:
  1. 3x3 그리드에 재료 배치 (클릭으로)
  2. 매칩 레시피 검색 (패턴 회전 포함)
  3. 매칭 시 결과 아이템 표시
  4. 클릭으로 결과 획득 → 재료 소모
```

## 의존성
- 없음 (독립)

## 성공 기준

- [ ] 블록 파괴 시 인벤토리에 추가된다
- [ ] 'E'로 인벤토리 창이 열린다
- [ ] 슬롯 간 아이템 이동이 가능하다
- [ ] 크래프팅 레시피가 작동한다
- [ ] 블록 설치 시 카운트가 감소한다
- [ ] 스택 최대 64개 제한
- [ ] 핫바와 인벤토리 연동

## 검증 방법

1. 여러 블록 부수기 → 인벤토리에 누적 확인
2. 'E' 키로 인벤토리 열기 → 슬롯 확인
3. 레시피 배치 → 결과 획득 확인
4. 설치 시 카운트 감소 확인

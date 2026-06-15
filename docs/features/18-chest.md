# 보물 상자 (Chest) 기능 설계

## 개요
클릭 시 인벤토리 UI를 열 수 있는 보물 상자 블록을 구현합니다. 상자는 27슬롯의 인벤토리를 가지며, 청크 언로드 시에도 데이터가 유지됩니다. BlockId.Chest=20으로 할당됩니다.

## 구현 범위
- 보물 상자 블록 모델 및 텍스처
- 상자 인벤토리 시스템 (27슬롯)
- 클릭 시 인벤토리 UI 열기
- 청크 언로드 시 데이터 유지
- 상자 레시피 (Wood 8개, 3x3 테두리)

## 수정 대상 파일
- `Game.ts`: onMouseDown에 상자 클릭 처리 로직 추가
- `World.ts`: chestInventories Map<"x,y,z", (ItemStack|null)[]> 추가
- `BlockId.ts`: Chest=20 추가
- `Recipe.ts`: 상자 레시피 추가
- `UIManager.ts`: 상자 인벤토리 UI 렌더링 (필요 시 신규 파일)

## 추가 파일
- `ChestInventory.ts`: 상자 인벤토리 관리 클래스
  ```typescript
  class ChestInventory {
    slots: (ItemStack | null)[] = new Array(27).fill(null);
    title: string;

    constructor(title: string) {
      this.title = title;
    }

    getSlot(index: number): ItemStack | null {
      return this.slots[index];
    }

    setSlot(index: number, item: ItemStack | null): void {
      this.slots[index] = item;
    }
  }
  ```

## 데이터 구조
- `World.chestInventories`: Map<"x,y,z", (ItemStack|null)[]>
```typescript
// 의사 코드
class World {
  chestInventories: Map<string, (ItemStack | null)[]> = new Map();

  getChestInventory(x, y, z): (ItemStack | null)[] | undefined {
    return this.chestInventories.get(`${x},${y},${z}`);
  }

  setChestInventory(x, y, z, inventory: (ItemStack | null)[]): void {
    this.chestInventories.set(`${x},${y},${z}`, inventory);

    // Modification으로 기록
    this.modificationMap.set(`${x},${y},${z}`, {
      blockId: BlockId.Chest,
      chestInventory: inventory,
    });
  }
}
```

## 핵심 로직
1. 상자 배치 시:
```typescript
function placeChest(world, x, y, z): void {
  world.setBlock(x, y, z, BlockId.Chest);

  // 빈 인벤토리 생성
  const inventory = new Array(27).fill(null);
  world.setChestInventory(x, y, z, inventory);
}
```

2. 상자 클릭 시:
```typescript
function onChestClick(world, x, y, z, uiManager): void {
  const inventory = world.getChestInventory(x, y, z);
  if (inventory) {
    uiManager.openChestUI(inventory, x, y, z);
  }
}
```

3. 인벤토리 UI 열기:
```typescript
class UIManager {
  openChestUI(inventory: (ItemStack | null)[], x, y, z): void {
    // HTML UI 생성
    const chestUI = document.createElement('div');
    chestUI.className = 'chest-inventory';

    // 27 슬롯 렌더링
    for (let i = 0; i < 27; i++) {
      const slot = this.createSlot(inventory[i], i);
      chestUI.appendChild(slot);
    }

    document.body.appendChild(chestUI);
    this.currentChestUI = { ui: chestUI, x, y, z };
  }
}
```

4. 슬롯 아이템 변경 시:
```typescript
function onSlotChanged(uiManager, slotIndex, item: ItemStack | null): void {
  const { inventory, x, y, z } = uiManager.currentChestUI;
  inventory[slotIndex] = item;
  world.setChestInventory(x, y, z, inventory);
}
```

5. 상자 파괴 시:
```typescript
function breakChest(world, x, y, z): void {
  const inventory = world.getChestInventory(x, y, z);
  if (inventory) {
    // 아이템 드롭
    for (const item of inventory) {
      if (item) {
        spawnDroppedItem(x, y, z, item);
      }
    }

    // 데이터 삭제
    world.chestInventories.delete(`${x},${y},${z}`);
    world.modificationMap.delete(`${x},${y},${z}`);
  }

  world.setBlock(x, y, z, BlockId.Air);
}
```

## 충돌/의존성
- World.modificationMap과 chestInventories의 동기화 필요
- UIManager와의 연동 (UI 렌더링)
- 청크 언로드 시 chestInventories 보존 로직 필요
- 의존성: 없음 (독립적 기능)

## 테스트 방법
1. 상자 레시피 테스트: Wood 8개로 상자 제작 확인
2. 상자 배치 테스트: 배치 시 빈 인벤토리 생성 확인
3. UI 열기 테스트: 상자 클릭 시 인벤토리 UI 열리는지 확인
4. 아이템 저장 테스트: 아이템 넣고 다시 열리는지 확인
5. 상자 파괴 테스트: 파괴 시 아이템 드롭 확인
6. 청크 언로드 테스트: 청크 언로드 후 상자 데이터 유지 확인
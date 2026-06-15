# 백팩 인벤토리 확장 구현 설계

## 개요

백팩 아이템은 플레이어의 인벤토리 슬롯 수를 확장하는 장비 아이템입니다. 가죽(Leather) 8개를 사용하여 제작하며, 장착하거나 사용할 때 인벤토리 용량을 기본 27슬롯에서 54슬롯으로 두 배로 확장합니다. 이는 더 많은 아이템을 보관하고 수집할 수 있게 해주는 퀄리티 오브 라이프(QoL) 기능입니다.

## 구현 범위

- Items 열거형에 가죽(Leather=262)과 백팩(Backpack=263) 아이템 추가
- ItemStack 인터페이스에 durability 속성 활용 (백팩 내구도)
- 백팩 제작 레시피 구현 (shaped, 3x3 테두리 패턴)
- Inventory.slots 배열 동적 확장 (27 → 54)
- InventoryUI에 확장된 슬롯 렌더링
- 백팩 장착/해제 로직

## 수정 대상 파일

### 1. `Items.ts`
```
enum Items {
    // 기존 아이템 (256-261 유지)
    IronIngot = 256,
    GoldIngot = 257,
    Diamond = 258,
    Stick = 259,
    WoodPlank = 260,
    StoneTool = 261,

    // 신규 추가
    Leather = 262,      // 가죽
    Backpack = 263,     // 백팩
}

export function getItemName(itemId: number): string {
    const names = {
        256: 'Iron Ingot',
        257: 'Gold Ingot',
        258: 'Diamond',
        259: 'Stick',
        260: 'Wood Plank',
        261: 'Stone Tool',
        262: 'Leather',      // 추가
        263: 'Backpack',     // 추가
    };
    return names[itemId] || 'Unknown';
}
```

### 2. `Inventory.ts`
```
class Inventory {
    private slots: ItemStack[] = [];
    private maxSize: number = 27;
    private hasBackpack: boolean = false;

    constructor() {
        this.slots = new Array(27).fill(null);
    }

    // 백팩 장착 메서드
    equipBackpack(): boolean {
        if (this.hasBackpack) {
            return false;  // 이미 백팩 장착됨
        }

        // 슬롯 27개 확장
        const newSlots = new Array(27).fill(null);
        this.slots = this.slots.concat(newSlots);
        this.maxSize = 54;
        this.hasBackpack = true;

        return true;
    }

    // 백팩 해제 메서드
    unequipBackpack(): boolean {
        if (!this.hasBackpack) {
            return false;
        }

        // 확장 슬롯에 아이템이 있는지 확인
        const hasItemsInBackpack = this.slots.slice(27).some(slot => slot !== null);

        if (hasItemsInBackpack) {
            return false;  // 백팩에 아이템 있어 해제 불가
        }

        // 슬롯 27개로 축소
        this.slots = this.slots.slice(0, 27);
        this.maxSize = 27;
        this.hasBackpack = false;

        return true;
    }

    addItem(itemId: number, count: number, durability?: number): boolean {
        if (this.slots.length >= this.maxSize && !this.hasEmptySlot()) {
            return false;  // 인벤토리 꽉 참
        }

        // 기존 addItem 로직 유지
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i] !== null &&
                this.slots[i].itemId === itemId &&
                itemId < 300) {  // 스태킹 가능 아이템

                this.slots[i].count += count;
                return true;
            }
        }

        // 빈 슬롯에 새 아이템 추가
        const emptySlotIndex = this.slots.indexOf(null);
        if (emptySlotIndex !== -1) {
            this.slots[emptySlotIndex] = { itemId, count, durability };
            return true;
        }

        return false;
    }

    hasEmptySlot(): boolean {
        return this.slots.some(slot => slot === null);
    }
}
```

### 3. `Crafting.ts`
```
// 백팩 제작 레시피 (3x3 테두리 패턴)
CRAFTING_RECIPES.push({
    pattern: [
        'LLL',
        'L L',
        'LLL',
    ],
    key: {
        'L': { itemId: 262, count: 1 },  // 가죽
    },
    output: { itemId: 263, count: 1 },  // 백팩
    recipeType: 'shaped',
});

// 레시피 매칭 로직
function matchShapedRecipe(grid: ItemStack[][], recipe: ShapedRecipe): ItemStack | null {
    const height = grid.length;
    const width = grid[0].length;

    // 레시피 패턴과 크기 비교
    if (height !== recipe.pattern.length || width !== recipe.pattern[0].length) {
        return null;
    }

    // 각 셀 매칭
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const gridCell = grid[y][x];
            const patternChar = recipe.pattern[y][x];

            if (patternChar === ' ') {
                // 공백은 빈 슬롯이어야 함
                if (gridCell !== null) {
                    return null;
                }
            } else {
                const requiredItem = recipe.key[patternChar];
                if (gridCell === null || gridCell.itemId !== requiredItem.itemId) {
                    return null;
                }
            }
        }
    }

    // 레시피 매칭 성공
    return {
        itemId: recipe.output.itemId,
        count: recipe.output.count,
        durability: 100,  // 백팩 내구도 100
    };
}
```

### 4. `InventoryUI.ts`
```
class InventoryUI {
    private inventory: Inventory;
    private container: HTMLElement;

    render() {
        this.container.innerHTML = '';

        const slotCount = this.inventory.getSlotCount();
        const rows = Math.ceil(slotCount / 9);

        // 9열 그리드 생성
        const grid = document.createElement('div');
        grid.className = 'inventory-grid';
        grid.style.gridTemplateColumns = 'repeat(9, 50px)';

        for (let i = 0; i < slotCount; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotIndex = i.toString();

            // 백팩 영역 표시 (27번 슬롯 이후)
            if (i >= 27) {
                slot.classList.add('backpack-slot');
            }

            const item = this.inventory.getSlot(i);
            if (item) {
                this.renderItem(slot, item);
            }

            grid.appendChild(slot);
        }

        this.container.appendChild(grid);
    }

    renderItem(slotElement: HTMLElement, item: ItemStack) {
        const itemIcon = document.createElement('div');
        itemIcon.className = 'item-icon';
        itemIcon.textContent = getItemName(item.itemId);

        if (item.durability !== undefined) {
            // 백팩 내구도 표시
            if (item.itemId === 263) {  // Backpack
                const durabilityBar = document.createElement('div');
                durabilityBar.className = 'durability-bar';
                durabilityBar.style.width = `${item.durability}%`;
                slotElement.appendChild(durabilityBar);
            }
        }

        const countLabel = document.createElement('div');
        countLabel.className = 'item-count';
        countLabel.textContent = item.count.toString();

        slotElement.appendChild(itemIcon);
        if (item.count > 1) {
            slotElement.appendChild(countLabel);
        }
    }
}
```

### 5. `Controls.ts`
```
class Controls {
    private keys: Record<string, boolean> = {};

    // 백팩 장착 키 (B)
    handleBackpackToggle() {
        if (this.keys['KeyB']) {
            this.keys['KeyB'] = false;  // 토글 방지

            const inventory = Game.getInstance().getInventory();

            if (inventory.hasBackpack()) {
                const success = inventory.unequipBackpack();
                if (!success) {
                    console.log('백팩에 아이템이 있어 해제할 수 없습니다.');
                }
            } else {
                // 백팩 아이템 소비
                const backpackSlot = inventory.findItem(263);  // Backpack itemId

                if (backpackSlot) {
                    inventory.consumeItem(backpackSlot, 1);
                    inventory.equipBackpack();
                } else {
                    console.log('백팩 아이템이 없습니다.');
                }
            }
        }
    }
}
```

## 추가 파일

### `BackpackSystem.ts` (선택 사항)
```
class BackpackSystem {
    private inventory: Inventory;

    constructor(inventory: Inventory) {
        this.inventory = inventory;
    }

    // 백팩 장착 시 애니메이션
    playEquipAnimation(): void {
        // 플레이어 모델에 백팩 메시 추가
        const playerModel = Game.getInstance().getPlayerModel();
        const backpackMesh = MeshBuilder.createBackpackMesh();
        playerModel.attachBackpack(backpackMesh);
    }

    // 백팩 해제 시 애니메이션
    playUnequipAnimation(): void {
        const playerModel = Game.getInstance().getPlayerModel();
        playerModel.detachBackpack();
    }
}
```

## 데이터 구조

### ItemStack 인터페이스
```
interface ItemStack {
    itemId: number;
    count: number;
    durability?: number;  // 백팩 내구도 (0-100)
}
```

### Inventory 상태
```
interface InventoryState {
    slots: (ItemStack | null)[];
    maxSize: number;        // 27 (기본) 또는 54 (백팩 장착)
    hasBackpack: boolean;
}
```

### ShapedRecipe 인터페이스
```
interface ShapedRecipe {
    pattern: string[];      // ['LLL', 'L L', 'LLL']
    key: Record<string, { itemId: number, count: number }>;
    output: { itemId: number, count: number };
    recipeType: 'shaped';
}
```

## 핵심 로직

### 백팩 제작 로직
```
function craftBackpack(grid: ItemStack[][], inventory: Inventory): boolean {
    const backpackRecipe = findBackpackRecipe();
    const result = matchShapedRecipe(grid, backpackRecipe);

    if (!result) {
        return false;  // 레시피 불일치
    }

    // 재료 소비 (가죽 8개)
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const char = backpackRecipe.pattern[y][x];
            if (char !== ' ') {
                grid[y][x].count -= 1;
                if (grid[y][x].count === 0) {
                    grid[y][x] = null;
                }
            }
        }
    }

    // 결과 아이템 추가
    inventory.addItem(result.itemId, result.count, result.durability);

    return true;
}
```

### 백팩 장착 로직
```
function useBackpackItem(player: Player, slotIndex: number): boolean {
    const inventory = player.getInventory();
    const slot = inventory.getSlot(slotIndex);

    if (!slot || slot.itemId !== 263) {  // Backpack
        return false;
    }

    // 이미 백팩 장착 확인
    if (inventory.hasBackpack()) {
        console.log('이미 백팩을 장착하고 있습니다.');
        return false;
    }

    // 백팩 아이템 소비
    slot.count -= 1;
    if (slot.count === 0) {
        inventory.setSlot(slotIndex, null);
    }

    // 인벤토리 확장
    inventory.equipBackpack();

    // UI 업데이트
    InventoryUI.getInstance().render();

    // 애니메이션
    BackpackSystem.getInstance().playEquipAnimation();

    return true;
}
```

### 인벤토리 슬롯 확장 로직
```
function expandInventory(inventory: Inventory): void {
    const currentSlots = inventory.getSlots();
    const emptySlots = new Array(27).fill(null);

    // 기존 27 슬롯 + 새로운 27 슬롯
    inventory.setSlots(currentSlots.concat(emptySlots));

    // 최대 크기 업데이트
    inventory.setMaxSize(54);

    // UI에 확장 슬롯 추가
    InventoryUI.getInstance().renderBackpackSlots();
}
```

### 백팩 해제 로직
```
function unequipBackpack(inventory: Inventory): boolean {
    // 백팩 슬롯에 아이템 확인
    const backpackSlots = inventory.getSlots().slice(27);
    const hasItems = backpackSlots.some(slot => slot !== null);

    if (hasItems) {
        console.log('백팩에 아이템이 있어 해제할 수 없습니다.');
        return false;
    }

    // 슬롯 축소
    const basicSlots = inventory.getSlots().slice(0, 27);
    inventory.setSlots(basicSlots);
    inventory.setMaxSize(27);
    inventory.setHasBackpack(false);

    // UI 업데이트
    InventoryUI.getInstance().render();

    // 애니메이션
    BackpackSystem.getInstance().playUnequipAnimation();

    return true;
}
```

## 충돌/의존성

### 의존성
- `Items.ts`: 가죽, 백팩 아이템 정의
- `Inventory.ts`: 슬롯 확장, 장착/해제 로직
- `Crafting.ts`: shaped recipe 매칭 시스템
- `InventoryUI.ts`: 확장 슬롯 렌더링
- `Controls.ts`: 백팩 장착 키 입력 처리
- `Game.ts`: 인벤토리 접근, 플레이어 모델

### 잠재적 충돌

1. **기존 아이템 ID 중복**
   - 확인: 262, 263가 기존 아이템 ID와 중복되지 않음
   - 해결: Items.ts 열거형 검증

2. **인벤토리 UI 레이아웃**
   - 문제: 9열 그리드가 6행으로 확장되면 화면 너머로 나갈 수 있음
   - 해결: CSS 스크롤 또는 줌아웃 지원

3. **백팩 장착 시 아이템 손실**
   - 문제: 장착 중 버그로 인해 확장 슬롯의 아이템 손실 가능
   - 해결: 장착 전 데이터 백업, 해제 불가 로직 강화

4. **세이브/로드 호환성**
   - 문제: 기존 세이브 데이터는 슬롯 27개만 있음
   - 해결: 세이브 로드 시 슬롯 크기 자동 조정

5. **백팩 장착 상태 저장**
   - 문제: 게임 종료 후 재시작 시 백팩 장착 상태 유지 필요
   - 해결: GameState에 hasBackpack 플래그 저장

## 테스트 방법

### 1. 기능 테스트

```
테스트 1: 백팩 제작
- 가죽 8개 확보
- 3x3 크래프팅 그리드에 테두리 패턴으로 배치
- 결과: 백팩 아이템 1개 생성 확인

테스트 2: 백팩 장착
- 백팩 아이템 선택 후 사용 (우클릭)
- 결과: 인벤토리 슬롯 27 → 54로 확장

테스트 3: 확장 슬롯 UI 렌더링
- 백팩 장착 후 인벤토리 UI 열기
- 결과: 6행 슬롯 그리드 표시 (4-6행은 백팩 영역으로 표시)

테스트 4: 확장 슬롯에 아이템 추가
- 확장 슬롯에 아이템 드롭
- 결과: 54개 슬롯까지 아이템 추가 가능

테스트 5: 백팩 해제 (빈 상태)
- 백팩 영역 슬롯 모두 비우고 해제 시도
- 결과: 슬롯 27개로 축소
```

### 2. 경계 테스트

```
테스트 6: 백팩 해제 불가 (아이템 있음)
- 백팩 영역에 아이템 1개 있고 해제 시도
- 결과: 해제 거부, 경고 메시지 표시

테스트 7: 인벤토리 꽉 찬 상태
- 54개 슬롯 모두 채우고 추가 아이템 획득 시도
- 결과: 아이템 추가 거부

테스트 8: 백팩 재장착
- 백팩 해제 후 다시 장착
- 결과: 정상 동작
```

### 3. 성능 테스트

```
테스트 9: 확장된 인벤토리 렌더링
- 54개 슬롯 모두 아이템으로 채움
- 인벤토리 UI 열기/닫기 반복
- 결과: 렌더링 지연 없음

테스트 10: 백팩 장착/해제 반복
- 100회 장착/해제 반복
- 결과: 메모리 누수 없음
```

### 4. 호환성 테스트

```
테스트 11: 기존 세이브 로드
- 백팩 없는 상태에서 저장
- 백팩 추가 후 로드
- 결과: 슬롯 27개 유지

테스트 12: 백팩 장착 상태 세이브/로드
- 백팩 장착 후 저장
- 게임 재시작 후 로드
- 결과: 슬롯 54개, 백팩 상태 유지
```

### 5. 크래프팅 테스트

```
테스트 13: 잘못된 레시피
- 가죽 7개로 패턴 시도
- 결과: 백팩 생성되지 않음

테스트 14: 패턴 회전
- 백팩 패턴을 90도 회전하여 배치
- 결과: 생성되지 않음 (shaped 레시피는 방향 민감)
```
# 26. 갑옷 시스템 (Armor System)

## 개요
헬멧, 흉갑, 레깅스, 부츠 4종의 갑옷 슬롯을 구현하고, 재료에 따라 Leather/Iron/Diamond 3티어로 분류한다. 갑옷 착용 시 데미지를 감소시키며, 인벤토리 UI에 장비 슬롯을 추가한다.

## 구현 범위
- ArmorSlot 타입 정의 (helmet, chestplate, leggings, boots)
- Player 클래스에 armorSlots 추가
- 장비 UI: 인벤토리 패널에 4칸 장비 슬롯 구현
- 데미지 계산: armorRating 합산 → damage * (1 - rating/30)
- 갑옷 제작 레시피 (재료 배치)
- 갑옷 장비/장착 해제 로직

## 수정 대상 파일
- `src/entities/Player.ts`: armorSlots 추가, 데미지 계산 수정
- `src/inventory/InventoryUI.ts`: 장비 슬롯 UI 추가
- `src/combat/Combat.ts`: 데미지 계산에 갑옷 적용
- `src/crafting/Recipes.ts`: 갑옷 레시피 등록
- `src/data/Block.ts`: 갑옷 아이템 ID 추가

## 추가 파일
- `src/inventory/ArmorSlot.ts`: 장비 슬롯 데이터 구조
- `src/combat/ArmorCalculator.ts`: 갑옷 데미지 감소 계산
- `src/items/ArmorItem.ts`: 갑옷 아이템 클래스

## 데이터 구조
```typescript
// 갑옷 슬롯 타입
enum ArmorSlotType {
  Helmet = 'helmet',
  Chestplate = 'chestplate',
  Leggings = 'leggings',
  Boots = 'boots'
}

// 갑옷 티어
enum ArmorTier {
  Leather = 0,
  Iron = 1,
  Diamond = 2
}

// 갑옷 아이템
interface ArmorItem {
  id: number;
  slotType: ArmorSlotType;
  tier: ArmorTier;
  durability: number;
  maxDurability: number;
  armorRating: number;  // 1티어: 5, 2티어: 8, 3티어: 12
}

// 플레이어 장비 슬롯
interface ArmorSlots {
  helmet: ArmorItem | null;
  chestplate: ArmorItem | null;
  leggings: ArmorItem | null;
  boots: ArmorItem | null;
}

// 갑옷 통계
interface ArmorStats {
  totalRating: number;
  durabilityPercent: number;
  isFullSet: boolean;
}
```

## 핵심 로직

### 1. 갑옷 아이템 정의
```typescript
// ArmorItem.ts
const ARMOR_DEFINITIONS = {
  [ArmorTier.Leather]: {
    [ArmorSlotType.Helmet]: { rating: 5, durability: 55 },
    [ArmorSlotType.Chestplate]: { rating: 5, durability: 80 },
    [ArmorSlotType.Leggings]: { rating: 4, durability: 75 },
    [ArmorSlotType.Boots]: { rating: 4, durability: 65 }
  },
  [ArmorTier.Iron]: {
    [ArmorSlotType.Helmet]: { rating: 8, durability: 165 },
    [ArmorSlotType.Chestplate]: { rating: 8, durability: 240 },
    [ArmorSlotType.Leggings]: { rating: 7, durability: 225 },
    [ArmorSlotType.Boots]: { rating: 7, durability: 195 }
  },
  [ArmorTier.Diamond]: {
    [ArmorSlotType.Helmet]: { rating: 12, durability: 363 },
    [ArmorSlotType.Chestplate]: { rating: 12, durability: 528 },
    [ArmorSlotType.Leggings]: { rating: 11, durability: 495 },
    [ArmorSlotType.Boots]: { rating: 11, durability: 429 }
  }
};

function createArmorItem(tier: ArmorTier, slotType: ArmorSlotType): ArmorItem {
  const def = ARMOR_DEFINITIONS[tier][slotType];
  return {
    id: getArmorItemId(tier, slotType),
    slotType,
    tier,
    durability: def.durability,
    maxDurability: def.durability,
    armorRating: def.rating
  };
}

function getArmorItemId(tier: ArmorTier, slotType: ArmorSlotType): number {
  const baseId = 300;  // 갑옷 아이템 시작 ID
  const tierOffset = tier * 10;
  const slotOffset = {
    [ArmorSlotType.Helmet]: 0,
    [ArmorSlotType.Chestplate]: 1,
    [ArmorSlotType.Leggings]: 2,
    [ArmorSlotType.Boots]: 3
  }[slotType];
  return baseId + tierOffset + slotOffset;
}
```

### 2. Player 장비 슬롯
```typescript
// Player.ts
class Player extends Entity {
  public armorSlots: ArmorSlots = {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null
  };

  equipArmor(armor: ArmorItem): boolean {
    const slot = armor.slotType;

    // 슬롯이 비어있으면 장착
    if (this.armorSlots[slot] === null) {
      this.armorSlots[slot] = armor;
      this.updateArmorStats();
      return true;
    }

    // 슬롯에 이미 장착된 아이템 교체
    this.inventory.addItem(this.armorSlots[slot]);
    this.armorSlots[slot] = armor;
    this.updateArmorStats();
    return true;
  }

  unequipArmor(slot: ArmorSlotType): ArmorItem | null {
    const armor = this.armorSlots[slot];

    if (armor !== null) {
      this.inventory.addItem(armor);
      this.armorSlots[slot] = null;
      this.updateArmorStats();
    }

    return armor;
  }

  updateArmorStats(): void {
    this.stats.totalArmorRating = this.calculateTotalArmorRating();
    this.stats.armorDurability = this.calculateDurabilityPercent();
  }

  calculateTotalArmorRating(): number {
    let rating = 0;

    Object.values(this.armorSlots).forEach(armor => {
      if (armor !== null) {
        rating += armor.armorRating;
      }
    });

    return rating;
  }

  calculateDurabilityPercent(): number {
    let totalDurability = 0;
    let totalMax = 0;

    Object.values(this.armorSlots).forEach(armor => {
      if (armor !== null) {
        totalDurability += armor.durability;
        totalMax += armor.maxDurability;
      }
    });

    return totalMax > 0 ? (totalDurability / totalMax) * 100 : 0;
  }
}
```

### 3. 데미지 감소 계산
```typescript
// Combat.ts
function applyArmorReduction(baseDamage: number, armorRating: number): number {
  // 최대 감소: 30 (모든 슬롯 다이아몬드)
  const maxReduction = 30;
  const clampedRating = Math.min(armorRating, maxReduction);

  // 데미지 감소: rating/30 * 80% (최대 80% 감소)
  const reductionFactor = clampedRating / maxReduction * 0.8;
  const reducedDamage = baseDamage * (1 - reductionFactor);

  return Math.max(0, Math.floor(reducedDamage));
}

function calculateArmorDurabilityLoss(damage: number, armorSlots: ArmorSlots): void {
  // 각 갑옷 부위에 균등하게 내구성 손실 분배
  const lossPerSlot = damage / 4;

  Object.values(armorSlots).forEach(armor => {
    if (armor !== null) {
      armor.durability = Math.max(0, armor.durability - lossPerSlot);

      // 내구성 0이면 장비 해제
      if (armor.durability <= 0) {
        // 장비 파괴 효과
        this.unequipArmor(armor.slotType);
      }
    }
  });
}

// Player 피격 처리
class Player extends Entity {
  takeDamage(damage: number, source: DamageSource): void {
    // 갑옷 감소 적용
    const armorRating = this.calculateTotalArmorRating();
    const reducedDamage = applyArmorReduction(damage, armorRating);

    // 내구성 손실
    calculateArmorDurabilityLoss(damage, this.armorSlots);

    // 실제 데미지 적용
    super.takeDamage(reducedDamage, source);

    // 갑옷 스탯 업데이트
    this.updateArmorStats();
  }
}
```

### 4. 장비 UI 구현
```typescript
// InventoryUI.ts
class InventoryUI {
  private armorSlots: HTMLElement[] = [];

  createArmorPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'armor-panel';

    const slotTypes = [
      { type: ArmorSlotType.Helmet, label: 'Helmet', icon: '🪖' },
      { type: ArmorSlotType.Chestplate, label: 'Chestplate', icon: '🦺' },
      { type: ArmorSlotType.Leggings, label: 'Leggings', icon: '👖' },
      { type: ArmorSlotType.Boots, label: 'Boots', icon: '👢' }
    ];

    slotTypes.forEach(slotType => {
      const slot = this.createArmorSlot(slotType);
      panel.appendChild(slot);
      this.armorSlots[slotType.type] = slot;
    });

    return panel;
  }

  createArmorSlot(config: { type: ArmorSlotType, label: string, icon: string }): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'armor-slot';
    slot.dataset.slotType = config.type;

    const label = document.createElement('div');
    label.className = 'armor-label';
    label.textContent = config.label;

    const icon = document.createElement('div');
    icon.className = 'armor-icon';
    icon.textContent = config.icon;

    slot.appendChild(icon);
    slot.appendChild(label);

    // 드래그 앤 드롭 이벤트
    slot.addEventListener('dragover', (e) => this.handleArmorDragOver(e, config.type));
    slot.addEventListener('drop', (e) => this.handleArmorDrop(e, config.type));

    return slot;
  }

  updateArmorSlots(armorSlots: ArmorSlots): void {
    Object.entries(armorSlots).forEach(([type, armor]) => {
      const slotEl = this.armorSlots[type];
      slotEl.innerHTML = '';

      if (armor !== null) {
        const itemEl = document.createElement('div');
        itemEl.className = 'armor-item';

        // 티어별 색상
        const tierColors = {
          [ArmorTier.Leather]: '#8B4513',
          [ArmorTier.Iron]: '#A9A9A9',
          [ArmorTier.Diamond]: '#00BFFF'
        };

        itemEl.style.backgroundColor = tierColors[armor.tier];
        itemEl.textContent = `${armor.tier} ${armor.slotType}`;

        // 내구성 표시
        const durabilityBar = document.createElement('div');
        durabilityBar.className = 'durability-bar';
        const percent = (armor.durability / armor.maxDurability) * 100;
        durabilityBar.style.width = `${percent}%`;
        durabilityBar.style.backgroundColor = percent < 20 ? '#FF4444' : '#44FF44';

        itemEl.appendChild(durabilityBar);
        slotEl.appendChild(itemEl);
      }
    });
  }

  handleArmorDrop(e: DragEvent, slotType: ArmorSlotType): void {
    e.preventDefault();

    const inventorySlot = e.dataTransfer?.getData('inventory-slot');
    const item = this.player.inventory.getItem(parseInt(inventorySlot));

    if (item && item instanceof ArmorItem && item.slotType === slotType) {
      this.player.armorSlots[slotType] = item;
      this.player.inventory.removeItem(parseInt(inventorySlot));
      this.updateArmorSlots(this.player.armorSlots);
    }
  }
}
```

### 5. 갑옷 제작 레시피
```typescript
// Recipes.ts
const ARMOR_RECIPES = [
  // Leather Armor
  {
    result: { item: getArmorItemId(ArmorTier.Leather, ArmorSlotType.Helmet), count: 1 },
    pattern: [
      ['L', 'L', 'L'],
      ['L', ' ', 'L'],
      [' ', ' ', ' ']
    ],
    ingredients: {
      'L': { item: BlockId.Leather }
    }
  },
  {
    result: { item: getArmorItemId(ArmorTier.Leather, ArmorSlotType.Chestplate), count: 1 },
    pattern: [
      ['L', ' ', 'L'],
      ['L', 'L', 'L'],
      ['L', 'L', 'L']
    ],
    ingredients: {
      'L': { item: BlockId.Leather }
    }
  },
  // Iron Armor
  {
    result: { item: getArmorItemId(ArmorTier.Iron, ArmorSlotType.Helmet), count: 1 },
    pattern: [
      ['I', 'I', 'I'],
      ['I', ' ', 'I'],
      [' ', ' ', ' ']
    ],
    ingredients: {
      'I': { item: BlockId.IronIngot }
    }
  },
  {
    result: { item: getArmorItemId(ArmorTier.Iron, ArmorSlotType.Chestplate), count: 1 },
    pattern: [
      ['I', ' ', 'I'],
      ['I', 'I', 'I'],
      ['I', 'I', 'I']
    ],
    ingredients: {
      'I': { item: BlockId.IronIngot }
    }
  },
  // Diamond Armor
  {
    result: { item: getArmorItemId(ArmorTier.Diamond, ArmorSlotType.Helmet), count: 1 },
    pattern: [
      ['D', 'D', 'D'],
      ['D', ' ', 'D'],
      [' ', ' ', ' ']
    ],
    ingredients: {
      'D': { item: BlockId.Diamond }
    }
  },
  {
    result: { item: getArmorItemId(ArmorTier.Diamond, ArmorSlotType.Chestplate), count: 1 },
    pattern: [
      ['D', ' ', 'D'],
      ['D', 'D', 'D'],
      ['D', 'D', 'D']
    ],
    ingredients: {
      'D': { item: BlockId.Diamond }
    }
  }
];
```

## 충돌/의존성

### 충돌 포인트
- **Player**: 기존 피격 로직에 갑옷 감소 통합
- **InventoryUI**: 인벤토리 패널에 장비 슬롯 추가
- **Combat**: 데미지 계산 시스템 확장

### 의존성
- `Entity`: Player 상속, takeDamage 오버라이드
- `Inventory`: 아이템 관리
- `Crafting`: 레시피 시스템

## 테스트 방법

### 단위 테스트
1. **데미지 감소**: 갑옷 레이팅별 감소율 계산 검증
2. **내구성**: 데미지에 따른 내구성 손실 확인
3. **장착/해제**: 슬롯 관리, 아이템 이동 확인

### 통합 테스트
1. **전투**: 몹 공격 시 갑옷 데미지 감소 확인
2. **UI**: 장착 슬롯 UI 드래그 앤 드롭
3. **제작**: 갑옷 레시피 제작 테스트
4. **파괴**: 내구성 0 도달 시 장비 해제

### 엣지 케이스
- 최대 갑옷(30)일 때 80% 감소
- 다양한 갑옷 조합 장착
- 내구성 0일 때 데미지 적용
- 장착 중 다른 아이템 장착 시 교체
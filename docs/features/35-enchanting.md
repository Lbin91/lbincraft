# 마법 부여 시스템 (Enchanting)

## 개요
LbinCraft에 마법 부여 시스템을 도입하여 도구와 갑옷에 특수 효과를 부여할 수 있습니다. 마법 부여 테이블 블록을 설치하고, 경험치(XP)를 획득하여 레벨업 후 마법 부여가 가능합니다. 인챈트 속성으로는 Sharpness(공격력 증가), Efficiency(채굴 속도 증가), Unbreaking(내구도 증가), Fortune(드롭 증가) 등이 있습니다. ItemStack에 enchantments 필드를 추가하여 인챈트 데이터를 저장하고, 인챈트 UI에서 3개의 랜덤 옵션 중 선택하여 XP 레벨을 소모합니다.

## 구현 범위
- 마법 부여 테이블 블록(34) + 상호작용 UI
- 경험치 시스템: 블록 파괴/몹 처치 시 XP 획득, 레벨업
- 인챈트 속성: Sharpness, Efficiency, Unbreaking, Fortune
- ItemStack.enchantments: Enchant[] 필드 추가
- 인챈트 UI: 3개 랜덤 옵션(레벨, 속성) 중 선택, XP 레벨 소모
- 인챈트 적용: 도구의 기능(공격력, 채굴 속도, 내구도, 드롭) 수정
- 인챈트 제한: 도구 유형별 가능한 인챈트 제한 (검: Sharpness/Unbreaking/Fortune, 곡괭이: Efficiency/Unbreaking/Fortune)

## 수정 대상 파일
- `Inventory.ts` - ItemStack.enchantments 필드 추가, 인챈트 효과 적용
- `ItemStack.ts` - Enchant[] 필드, 인챈트 효과 계산 메서드
- `Survival.ts` - XP 시스템, 인챈트 공격력 적용, 인챈트 채굴 속도 적용
- `Game.ts` - 마법 부여 테이블 상호작용, 인챈트 UI 호출
- `World.ts` - 마법 부여 테이블 블록(34) 지원

## 추가 파일
- `EnchantingSystem.ts` - 인챈트 로직 및 확률 계산
- `EnchantingUI.ts` - 인챈트 UI 구현
- `Enchantment.ts` - 인챈트 타입 및 효과 정의
- `EnchantingSystem.test.ts` - 단위 테스트

## 데이터 구조

### Enchantment
```typescript
// 인챈트 속성 enum
enum EnchantType {
  SHARPNESS = 'sharpness',      // 공격력 증가 (도구: 검)
  EFFICIENCY = 'efficiency',    // 채굴 속도 증가 (도구: 곡괭이, 도끼)
  UNBREAKING = 'unbreaking',    // 내구도 증가 (모든 도구)
  FORTUNE = 'fortune',          // 드롭 증가 (도구: 곡괭이)
  PROTECTION = 'protection',    // 방어력 증가 (갑옷)
  FEATHER_FALLING = 'feather_falling' // 낙하 데미지 감소 (부츠)
}

// 인챈트 데이터
interface Enchantment {
  type: EnchantType;
  level: number; // 1-5 (인챈트 레벨)
}

// 인챈트 효과 정의
interface EnchantEffect {
  // 도구에 적용 가능한지 확인
  applicableTo(itemType: ItemType): boolean;

  // 최대 레벨
  maxLevel(): number;

  // 레벨당 효과 계산
  calculateEffect(level: number): number;

  // XP 비용 계산
  calculateXPCost(level: number, slotIndex: number): number;

  // 랜덤 생성 가능성 확인 (시드 기반)
  canGenerate(seed: number, level: number): boolean;
}
```

### EnchantingSystem
```typescript
class EnchantingSystem {
  // 인챈트 효과 맵
  private static effects: Map<EnchantType, EnchantEffect> = new Map();

  static initialize(): void {
    // Sharpness 효과
    this.effects.set(EnchantType.SHARPNESS, {
      applicableTo: (itemType) => itemType === ItemType.SWORD,
      maxLevel: () => 5,
      calculateEffect: (level) => level * 2.5,
      calculateXPCost: (level, slotIndex) => (level + slotIndex) * 5,
      canGenerate: (seed, level) => {
        const rng = new SeededRandom(seed);
        return rng.random() < 0.3;
      }
    });

    // Efficiency 효과
    this.effects.set(EnchantType.EFFICIENCY, {
      applicableTo: (itemType) =>
        itemType === ItemType.PICKAXE || itemType === ItemType.AXE,
      maxLevel: () => 5,
      calculateEffect: (level) => level * 0.2,
      calculateXPCost: (level, slotIndex) => (level + slotIndex) * 4,
      canGenerate: (seed, level) => {
        const rng = new SeededRandom(seed);
        return rng.random() < 0.35;
      }
    });

    // Unbreaking 효과
    this.effects.set(EnchantType.UNBREAKING, {
      applicableTo: (itemType) =>
        itemType === ItemType.SWORD || itemType === ItemType.PICKAXE ||
        itemType === ItemType.AXE || itemType === ItemType.HELMET ||
        itemType === ItemType.CHESTPLATE || itemType === ItemType.LEGGINGS ||
        itemType === ItemType.BOOTS,
      maxLevel: () => 3,
      calculateEffect: (level) => level * 20,
      calculateXPCost: (level, slotIndex) => (level + slotIndex) * 3,
      canGenerate: (seed, level) => {
        const rng = new SeededRandom(seed);
        return rng.random() < 0.5;
      }
    });

    // Fortune 효과
    this.effects.set(EnchantType.FORTUNE, {
      applicableTo: (itemType) => itemType === ItemType.PICKAXE,
      maxLevel: () => 3,
      calculateEffect: (level) => level,
      calculateXPCost: (level, slotIndex) => (level + slotIndex) * 6,
      canGenerate: (seed, level) => {
        const rng = new SeededRandom(seed);
        return rng.random() < 0.2;
      }
    });

    // Protection 효과
    this.effects.set(EnchantType.PROTECTION, {
      applicableTo: (itemType) =>
        itemType === ItemType.HELMET || itemType === ItemType.CHESTPLATE ||
        itemType === ItemType.LEGGINGS || itemType === ItemType.BOOTS,
      maxLevel: () => 4,
      calculateEffect: (level) => level * 2,
      calculateXPCost: (level, slotIndex) => (level + slotIndex) * 4,
      canGenerate: (seed, level) => {
        const rng = new SeededRandom(seed);
        return rng.random() < 0.4;
      }
    });

    // Feather Falling 효과
    this.effects.set(EnchantType.FEATHER_FALLING, {
      applicableTo: (itemType) => itemType === ItemType.BOOTS,
      maxLevel: () => 4,
      calculateEffect: (level) => level * 5,
      calculateXPCost: (level, slotIndex) => (level + slotIndex) * 3,
      canGenerate: (seed, level) => {
        const rng = new SeededRandom(seed);
        return rng.random() < 0.25;
      }
    });
  }

  // 인챈트 옵션 생성 (3개)
  static generateEnchantOptions(itemStack: ItemStack, playerLevel: number, seed: number): EnchantOption[] {
    const options: EnchantOption[] = [];
    const applicableEnchants = this.getApplicableEnchants(itemStack);

    for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
      const slotSeed = seed + slotIndex;
      const rng = new SeededRandom(slotSeed);

      const availableEnchants = applicableEnchants.filter(ench =>
        ench.canGenerate(slotSeed, 1) &&
        this.calculateXPCost(ench, 1, slotIndex) <= playerLevel
      );

      if (availableEnchants.length === 0) {
        options.push({
          enchant: null,
          level: 0,
          xpCost: 0,
          valid: false
        });
        continue;
      }

      const selectedEnchant = availableEnchants[Math.floor(rng.random() * availableEnchants.length)];

      const maxPossibleLevel = Math.min(
        selectedEnchant.maxLevel(),
        Math.ceil(playerLevel / 5)
      );

      const level = 1 + Math.floor(rng.random() * maxPossibleLevel);

      const xpCost = this.calculateXPCost(selectedEnchant, level, slotIndex);

      options.push({
        enchant: selectedEnchant,
        level,
        xpCost,
        valid: xpCost <= playerLevel
      });
    }

    return options;
  }

  private static getApplicableEnchants(itemStack: ItemStack): EnchantType[] {
    const applicable: EnchantType[] = [];

    for (const [type, effect] of this.effects) {
      if (effect.applicableTo(itemStack.type)) {
        applicable.push(type);
      }
    }

    return applicable;
  }

  static applyEnchantment(itemStack: ItemStack, option: EnchantOption): boolean {
    if (!option.valid || !option.enchant) {
      return false;
    }

    const existingIndex = itemStack.enchantments.findIndex(e => e.type === option.enchant);

    if (existingIndex >= 0) {
      if (option.level > itemStack.enchantments[existingIndex].level) {
        itemStack.enchantments[existingIndex].level = option.level;
        return true;
      }
      return false;
    } else {
      itemStack.enchantments.push({
        type: option.enchant,
        level: option.level
      });
      return true;
    }
  }

  private static calculateXPCost(enchant: EnchantEffect, level: number, slotIndex: number): number {
    return enchant.calculateXPCost(level, slotIndex);
  }

  static applyEnchantEffect(
    itemStack: ItemStack,
    effectType: 'damage' | 'miningSpeed' | 'durability' | 'dropCount' | 'defense' | 'fallDamage',
    baseValue: number
  ): number {
    let totalEffect = 0;

    for (const enchant of itemStack.enchantments) {
      const effect = this.effects.get(enchant.type);
      if (!effect) continue;

      switch (effectType) {
        case 'damage':
          if (enchant.type === EnchantType.SHARPNESS) {
            totalEffect += effect.calculateEffect(enchant.level);
          }
          break;
        case 'miningSpeed':
          if (enchant.type === EnchantType.EFFICIENCY) {
            totalEffect += effect.calculateEffect(enchant.level);
          }
          break;
        case 'durability':
          if (enchant.type === EnchantType.UNBREAKING) {
            totalEffect += effect.calculateEffect(enchant.level);
          }
          break;
        case 'dropCount':
          if (enchant.type === EnchantType.FORTUNE) {
            totalEffect += effect.calculateEffect(enchant.level);
          }
          break;
        case 'defense':
          if (enchant.type === EnchantType.PROTECTION) {
            totalEffect += effect.calculateEffect(enchant.level);
          }
          break;
        case 'fallDamage':
          if (enchant.type === EnchantType.FEATHER_FALLING) {
            totalEffect += effect.calculateEffect(enchant.level);
          }
          break;
      }
    }

    return baseValue + totalEffect;
  }
}

interface EnchantOption {
  enchant: EnchantType | null;
  level: number;
  xpCost: number;
  valid: boolean;
}
```

### ItemStack 확장
```typescript
interface ItemStack {
  itemId: number;
  count: number;
  durability: number;
  maxDurability: number;
  type: ItemType;
  enchantments: Enchantment[];
  getEnchantEffect(effectType: 'damage' | 'miningSpeed' | 'durability' | 'dropCount' | 'defense' | 'fallDamage'): number;
  reduceDurability(amount: number): void;
}

class ItemStackImpl implements ItemStack {
  itemId: number;
  count: number;
  durability: number;
  maxDurability: number;
  type: ItemType;
  enchantments: Enchantment[] = [];

  constructor(itemId: number, count: number) {
    this.itemId = itemId;
    this.count = count;
    this.type = this.getItemType(itemId);
    this.durability = this.getMaxDurability(itemId);
    this.maxDurability = this.durability;
  }

  private getItemType(itemId: number): ItemType {
    switch (itemId) {
      case 6: return ItemType.SWORD;
      case 7: return ItemType.PICKAXE;
      case 8: return ItemType.AXE;
      case 37: return ItemType.HELMET;
      case 38: return ItemType.CHESTPLATE;
      case 39: return ItemType.LEGGINGS;
      case 40: return ItemType.BOOTS;
      default: return ItemType.NONE;
    }
  }

  private getMaxDurability(itemId: number): number {
    switch (itemId) {
      case 6: return 1562;
      case 7: return 1562;
      case 8: return 1562;
      case 37: return 363;
      case 38: return 528;
      case 39: return 495;
      case 40: return 429;
      default: return 100;
    }
  }

  getEnchantEffect(effectType: 'damage' | 'miningSpeed' | 'durability' | 'dropCount' | 'defense' | 'fallDamage'): number {
    return EnchantingSystem.applyEnchantEffect(this, effectType, 0);
  }

  reduceDurability(amount: number): void {
    const unbreakingEffect = this.getEnchantEffect('durability');
    const reduction = unbreakingEffect / 100;

    if (Math.random() > reduction) {
      this.durability -= amount;
      if (this.durability < 0) {
        this.durability = 0;
      }
    }
  }
}

enum ItemType {
  NONE = 'none',
  SWORD = 'sword',
  PICKAXE = 'pickaxe',
  AXE = 'axe',
  HELMET = 'helmet',
  CHESTPLATE = 'chestplate',
  LEGGINGS = 'leggings',
  BOOTS = 'boots'
}
```

### XP 시스템 (Survival.ts 확장)
```typescript
class Survival {
  health: number = 20;
  maxHealth: number = 20;
  hunger: number = 20;
  maxHunger: number = 20;

  // XP 시스템
  xp: number = 0;
  xpLevel: number = 0;
  xpToNextLevel: number = 10;

  addXP(amount: number): void {
    this.xp += amount;

    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.xpLevel++;
      this.xpToNextLevel = this.calculateXPForNextLevel(this.xpLevel);

      showNotification(`레벨업! 레벨 ${this.xpLevel}`);
      playSound('levelup');
    }
  }

  private calculateXPForNextLevel(level: number): number {
    return 10 + level * 5 + Math.floor(level * level * 0.5);
  }

  consumeXPLevel(amount: number): boolean {
    if (this.xpLevel < amount) {
      return false;
    }

    this.xpLevel -= amount;
    this.xp = 0;
    this.xpToNextLevel = this.calculateXPForNextLevel(this.xpLevel);

    return true;
  }

  getAttackDamage(heldItem: ItemStack | null): number {
    let baseDamage = 1;

    if (heldItem && heldItem.type === ItemType.SWORD) {
      baseDamage = 7;
    }

    if (heldItem) {
      baseDamage = EnchantingSystem.applyEnchantEffect(heldItem, 'damage', baseDamage);
    }

    return baseDamage;
  }

  getMiningSpeed(heldItem: ItemStack | null): number {
    let baseSpeed = 1;

    if (heldItem && (heldItem.type === ItemType.PICKAXE || heldItem.type === ItemType.AXE)) {
      baseSpeed = 5;
    }

    if (heldItem) {
      baseSpeed = EnchantingSystem.applyEnchantEffect(heldItem, 'miningSpeed', baseSpeed);
    }

    return baseSpeed;
  }

  getDropCount(baseDrop: number, heldItem: ItemStack | null): number {
    let dropCount = baseDrop;

    if (heldItem && heldItem.type === ItemType.PICKAXE) {
      dropCount = EnchantingSystem.applyEnchantEffect(heldItem, 'dropCount', dropCount);
    }

    return dropCount;
  }

  getDefense(item: ItemStack | null): number {
    let defense = 0;

    if (item && (item.type === ItemType.HELMET || item.type === ItemType.CHESTPLATE ||
                 item.type === ItemType.LEGGINGS || item.type === ItemType.BOOTS)) {
      switch (item.type) {
        case ItemType.HELMET: defense = 3; break;
        case ItemType.CHESTPLATE: defense = 8; break;
        case ItemType.LEGGINGS: defense = 6; break;
        case ItemType.BOOTS: defense = 3; break;
      }

      defense = EnchantingSystem.applyEnchantEffect(item, 'defense', defense);
    }

    return defense;
  }

  calculateFallDamage(height: number, boots: ItemStack | null): number {
    const baseDamage = Math.floor(height / 3);

    if (boots && boots.type === ItemType.BOOTS) {
      const reduction = EnchantingSystem.applyEnchantEffect(boots, 'fallDamage', 0);
      const damageAfterReduction = baseDamage * (1 - reduction / 100);
      return Math.max(0, Math.floor(damageAfterReduction));
    }

    return baseDamage;
  }
}
```

## 핵심 로직

### 1. 마법 부여 테이블 상호작용
```typescript
// Game.ts 우클릭 이벤트
onRightClick(blockX, blockY, blockZ): void {
  const blockId = this.world.getBlock(blockX, blockY, blockZ);

  if (blockId === 34) {
    this.openEnchantingUI();
    return;
  }
}

openEnchantingUI(): void {
  const enchantableItems = this.player.inventory.getEnchantableItems();

  this.enchantingUI.open(
    enchantableItems,
    this.player.survival.xpLevel,
    (selectedItem, selectedOption) => {
      const success = EnchantingSystem.applyEnchantment(selectedItem, selectedOption);

      if (success) {
        this.player.survival.consumeXPLevel(selectedOption.xpCost / 10);

        showNotification("인챈트 완료!");
        playSound('enchant');

        this.enchantingUI.updateItems();
      } else {
        showNotification("인챈트 실패");
      }
    }
  );
}
```

### 2. XP 획득
```typescript
// Game.ts 블록 파괴 이벤트
onBlockBreak(blockX, blockY, blockZ): void {
  const blockId = this.world.getBlock(blockX, blockY, blockZ);

  const xpReward = this.getXPRewardForBlock(blockId);
  if (xpReward > 0) {
    this.player.survival.addXP(xpReward);
    showXPGain(xpReward);
  }

  const baseDrop = this.getBaseDrop(blockId);
  const dropCount = this.player.survival.getDropCount(baseDrop, this.player.getHeldItem());

  for (let i = 0; i < dropCount; i++) {
    this.spawnItemDrop(blockX, blockY, blockZ, {itemId: blockId, count: 1});
  }

  this.world.setBlock(blockX, blockY, blockZ, 0);

  const heldItem = this.player.getHeldItem();
  if (heldItem) {
    heldItem.reduceDurability(1);

    if (heldItem.durability <= 0) {
      this.player.inventory.removeStack(heldItem);
      showNotification("아이템이 부서졌습니다.");
      playSound('item_break');
    }
  }
}

private getXPRewardForBlock(blockId: number): number {
  switch (blockId) {
    case 1: return 1;
    case 2: return 0;
    case 4: return 2;
    case 5: return 5;
    default: return 0;
  }
}
```

### 3. 인챈트 공격력 적용
```typescript
// Game.ts 공격 이벤트
onAttack(target: Entity): void {
  const heldItem = this.player.getHeldItem();
  const damage = this.player.survival.getAttackDamage(heldItem);

  target.takeDamage(damage, 'player');

  if (heldItem && heldItem.type === ItemType.SWORD) {
    heldItem.reduceDurability(1);

    if (heldItem.durability <= 0) {
      this.player.inventory.removeStack(heldItem);
      showNotification("검이 부러졌습니다.");
    }
  }
}
```

## 충돌/의존성
- **Inventory.ts 의존성**: ItemStack.enchantments 필드 추가, 인챈트 효과 적용. 기존 인벤토리 시스템과 호환
- **ItemStack.ts 의존성**: Enchant[] 필드, 인챈트 효과 계산 메서드 추가. 기존 아이템 시스템과 호환
- **Survival.ts 의존성**: XP 시스템, 인챈트 공격력/채굴 속도/드롭/방어력 적용. 기존 생존 시스템과 호환
- **Game.ts 의존성**: 마법 부여 테이블 상호작용, 인챈트 UI 호출. 기존 블록 상호작용과 충돌하지 않도록 조건 분기
- **World.ts 의존성**: 마법 부여 테이블 블록(34) 지원. 기존 블록 시스템과 호환
- **충돌 위험**: 인챈트 공격력이 너무 높으면 게임 밸런스 깨질 수 있음. Sharpness 레벨 최대치(5)와 효과(2.5) 조정 필요
- **성능 고려**: 매 프레임 인챈트 효과 계산 시 성능 영향. 효과 계산을 캐싱하여 최적화 가능

## 테스트 방법

### 1. 단위 테스트 (EnchantingSystem.test.ts)
```typescript
describe('EnchantingSystem', () => {
  test('should generate enchant options for sword', () => {
    const sword = new ItemStackImpl(6, 1); // Diamond Sword
    const options = EnchantingSystem.generateEnchantOptions(sword, 10, 12345);

    expect(options.length).toBe(3);
    options.forEach(opt => {
      if (opt.valid) {
        expect(opt.enchant).toBeOneOf([EnchantType.SHARPNESS, EnchantType.UNBREAKING]);
      }
    });
  });

  test('should apply sharpness enchant', () => {
    const sword = new ItemStackImpl(6, 1);
    const option: EnchantOption = {
      enchant: EnchantType.SHARPNESS,
      level: 3,
      xpCost: 15,
      valid: true
    };

    const success = EnchantingSystem.applyEnchantment(sword, option);

    expect(success).toBe(true);
    expect(sword.enchantments.length).toBe(1);
    expect(sword.enchantments[0].type).toBe(EnchantType.SHARPNESS);
    expect(sword.enchantments[0].level).toBe(3);
  });

  test('should calculate sharpness damage', () => {
    const sword = new ItemStackImpl(6, 1);
    sword.enchantments.push({type: EnchantType.SHARPNESS, level: 3});

    const damage = EnchantingSystem.applyEnchantEffect(sword, 'damage', 7);

    expect(damage).toBe(7 + 3 * 2.5); // 7 + 7.5 = 14.5
  });

  test('should apply unbreaking durability reduction', () => {
    const pickaxe = new ItemStackImpl(7, 1);
    pickaxe.enchantments.push({type: EnchantType.UNBREAKING, level: 2});

    const initialDurability = pickaxe.durability;

    // 내구도 감소 시도 10번
    for (let i = 0; i < 10; i++) {
      pickaxe.reduceDurability(1);
    }

    // Unbreaking 레벨 2 = 40% 감소 확률
    // 약 6번만 감소되어야 함
    expect(pickaxe.durability).toBeGreaterThan(initialDurability - 8);
  });
});

describe('Survival', () => {
  test('should level up with XP', () => {
    const survival = new Survival();

    survival.addXP(10); // 레벨 1 필요 XP

    expect(survival.xpLevel).toBe(1);
    expect(survival.xp).toBe(0);
    expect(survival.xpToNextLevel).toBe(15); // 레벨 2 필요 XP
  });

  test('should consume XP level', () => {
    const survival = new Survival();
    survival.addXP(30); // 레벨 3

    const success = survival.consumeXPLevel(1);

    expect(success).toBe(true);
    expect(survival.xpLevel).toBe(2);
  });

  test('should calculate attack damage with enchant', () => {
    const survival = new Survival();
    const sword = new ItemStackImpl(6, 1);
    sword.enchantments.push({type: EnchantType.SHARPNESS, level: 2});

    const damage = survival.getAttackDamage(sword);

    expect(damage).toBe(7 + 2 * 2.5); // 7 + 5 = 12
  });
});
```

### 2. 통합 테스트
- 인챈트 옵션 생성: 도구 유형별 올바른 인챈트 옵션이 생성되는지 확인
- 인챈트 적용: 인챈트가 올바르게 적용되고 ItemStack에 저장되는지 확인
- XP 획득: 블록 파괴/몹 처치 시 XP가 올바르게 획득되는지 확인
- 레벨업: XP 충족 시 레벨업이 올바르게 발생하는지 확인
- 인챈트 공격력: Sharpness 인챈트가 공격력에 올바르게 적용되는지 확인
- 인챈트 채굴 속도: Efficiency 인챈트가 채굴 속도에 올바르게 적용되는지 확인
- 인챈트 내구도: Unbreaking 인챈트가 내구도 감소를 올바르게 줄이는지 확인
- 인챈트 드롭: Fortune 인챈트가 드롭 수를 올바르게 증가시키는지 확인

### 3. 수동 테스트 시나리오
1. 다이아몬드 검(6) 제작
2. 마법 부여 테이블(34) 설치
3. 마법 부여 테이블 우클릭으로 인챈트 UI 열기
4. Sharpness 레벨 3 인챈트 선택 (XP 레벨 소모)
5. 인챈트 완료 확인
6. 좀비 공격 시 데미지 증가 확인 (기본 7 → 인챈트 14.5)
7. 다이아몬드 곡괭이(7) 제작
8. 곡괭이에 Efficiency 레벨 2 인챈트
9. 돌 채굴 속도 증가 확인
10. 곡괭이에 Unbreaking 레벨 2 인챈트
11. 채굴 시 내구도 감소 감소 확인 (약 40% 확률로 감소 안 됨)
12. 곡괭이에 Fortune 레벨 1 인챈트
13. 다이아몬드 광석 채굴 시 드롭 증가 확인
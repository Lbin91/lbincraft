# 양조 및 포션 시스템 (Potion Brewing)

## 개요
LbinCraft에 양조대 블록과 포션 시스템을 도입하여 상태이상 효과를 구현합니다. 양조대에 물병과 재료(넥더 와트, 거미 눈 등)를 넣어 다양한 포션을 제조할 수 있습니다. 포션을 마시면 Speed(이동속도 증가), Slowness(이동속도 감소), Strength(공격력 증가), Healing(체력 회복), Poison(독 데미지), NightVision(야간 투시), WaterBreathing(수중 호흡) 등의 효과가 발동됩니다. Survival에 activeEffects 필드를 추가하여 매 프레임 효과를 적용하고 지속시간을 감소시킵니다.

## 구현 범위
- 양조대 블록(35) + 상호작용 UI
- 포션 아이템(290) + effect 데이터 (EffectType, duration, amplifier)
- 상태이상 enum: Speed, Slowness, Strength, Healing, Poison, NightVision, WaterBreathing
- 양조 레시피: 물병 + 재료 → 포션
- Survival.activeEffects: ActiveEffect[] 추가, 매 프레임 효과 적용/지속시간 감소
- 효과 적용: Speed → moveSpeed 증가, Poison → 체력 감소, NightVision → 조명 증가
- 포션 지속시간: 기본 3분(180초), 증폭 시 1.5배
- 포션 스택 가능: 최대 64개

## 수정 대상 파일
- `Inventory.ts` - 포션 아이템(290) 추가, 포션 데이터 구조
- `ItemStack.ts` - PotionData 필드 추가
- `Survival.ts` - activeEffects 필드, 효과 적용/지속시간 감소, moveSpeed 조정
- `Game.ts` - 양조대 상호작용, 포션 마시기, 효과 표시 UI
- `World.ts` - 양조대 블록(35) 지원
- `MeshBuilder.ts` - 포션 지속시간 표시 UI

## 추가 파일
- `BrewingSystem.ts` - 양조 레시피 및 로직
- `BrewingUI.ts` - 양조대 UI 구현
- `EffectSystem.ts` - 상태이상 효과 및 적용
- `PotionRecipe.ts` - 포션 레시피 데이터
- `BrewingSystem.test.ts` - 단위 테스트

## 데이터 구조

### 상태이상 타입
```typescript
// 상태이상 타입 enum
enum EffectType {
  SPEED = 'speed',           // 이동속도 증가
  SLOWNESS = 'slowness',     // 이동속도 감소
  STRENGTH = 'strength',     // 공격력 증가
  HEALING = 'healing',       // 체력 회복
  POISON = 'poison',         // 독 데미지
  NIGHT_VISION = 'night_vision', // 야간 투시
  WATER_BREATHING = 'water_breathing' // 수중 호흡
}

// 활성화된 효과
interface ActiveEffect {
  type: EffectType;
  duration: number;  // 지속시간 (초)
  amplifier: number; // 증폭 레벨 (0-2)
  startTime: number; // 시작 시간 (타임스탬프)
}

// 포션 데이터
interface PotionData {
  effectType: EffectType;
  duration: number;  // 지속시간 (초)
  amplifier: number; // 증폭 레벨 (0-2)
  isSplash: boolean; // 스플래시 포션 여부
}
```

### EffectSystem
```typescript
class EffectSystem {
  // 효과 적용
  static applyEffect(effect: ActiveEffect, survival: Survival, deltaTime: number): void {
    effect.duration -= deltaTime;

    if (effect.duration <= 0) {
      return;
    }

    switch (effect.type) {
      case EffectType.SPEED:
        this.applySpeedEffect(effect, survival);
        break;
      case EffectType.SLOWNESS:
        this.applySlownessEffect(effect, survival);
        break;
      case EffectType.STRENGTH:
        this.applyStrengthEffect(effect, survival);
        break;
      case EffectType.HEALING:
        this.applyHealingEffect(effect, survival, deltaTime);
        break;
      case EffectType.POISON:
        this.applyPoisonEffect(effect, survival, deltaTime);
        break;
      case EffectType.NIGHT_VISION:
        this.applyNightVisionEffect(effect, survival);
        break;
      case EffectType.WATER_BREATHING:
        this.applyWaterBreathingEffect(effect, survival);
        break;
    }
  }

  // Speed 효과 적용
  private static applySpeedEffect(effect: ActiveEffect, survival: Survival): void {
    // 증폭 레벨당 20% 이동속도 증가
    const speedBoost = effect.amplifier * 0.2;
    survival.moveSpeed = survival.baseMoveSpeed * (1 + speedBoost);
  }

  // Slowness 효과 적용
  private static applySlownessEffect(effect: ActiveEffect, survival: Survival): void {
    // 증폭 레벨당 15% 이동속도 감소
    const speedReduction = effect.amplifier * 0.15;
    survival.moveSpeed = survival.baseMoveSpeed * (1 - speedReduction);
  }

  // Strength 효과 적용
  private static applyStrengthEffect(effect: ActiveEffect, survival: Survival): void {
    // 증폭 레벨당 1.3 배 공격력 증가
    const damageMultiplier = 1 + effect.amplifier * 0.3;
    survival.attackDamageMultiplier = damageMultiplier;
  }

  // Healing 효과 적용
  private static applyHealingEffect(effect: ActiveEffect, survival: Survival, deltaTime: number): void {
    // 증폭 레벨당 초당 1 체력 회복
    const healRate = 1 + effect.amplifier * 0.5;
    survival.health = Math.min(
      survival.maxHealth,
      survival.health + healRate * deltaTime
    );
  }

  // Poison 효과 적용
  private static applyPoisonEffect(effect: ActiveEffect, survival: Survival, deltaTime: number): void {
    // 증폭 레벨당 초당 0.5 체력 데미지
    const damageRate = 0.5 + effect.amplifier * 0.25;
    survival.health = Math.max(
      0,
      survival.health - damageRate * deltaTime
    );

    if (survival.health <= 0) {
      survival.takeDamage(0, 'poison');
    }
  }

  // NightVision 효과 적용
  private static applyNightVisionEffect(effect: ActiveEffect, survival: Survival): void {
    // 야간 투시 활성화
    survival.nightVisionActive = true;
  }

  // WaterBreathing 효과 적용
  private static applyWaterBreathingEffect(effect: ActiveEffect, survival: Survival): void {
    // 수중 호흡 활성화 (산소 소모 없음)
    survival.waterBreathingActive = true;
  }

  // 효과 표시 이름 가져오기
  static getEffectDisplayName(type: EffectType): string {
    switch (type) {
      case EffectType.SPEED: return "속도 증가";
      case EffectType.SLOWNESS: return "속도 감소";
      case EffectType.STRENGTH: return "힘 증가";
      case EffectType.HEALING: return "치유";
      case EffectType.POISON: return "독";
      case EffectType.NIGHT_VISION: return "야간 투시";
      case EffectType.WATER_BREATHING: return "수중 호흡";
      default: return "알 수 없는 효과";
    }
  }

  // 효과 지속시간 포맷팅
  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
```

### BrewingSystem
```typescript
class BrewingSystem {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  // 양조 가능한지 확인
  canBrew(baseItem: ItemStack, ingredient: ItemStack): boolean {
    const baseItemId = baseItem.itemId;
    const ingredientItemId = ingredient.itemId;

    // 레시피 확인
    return PotionRecipe.getRecipe(baseItemId, ingredientItemId) !== null;
  }

  // 양조 실행
  brew(baseItem: ItemStack, ingredient: ItemStack): ItemStack | null {
    if (!this.canBrew(baseItem, ingredient)) {
      return null;
    }

    const recipe = PotionRecipe.getRecipe(baseItem.itemId, ingredient.itemId);
    if (!recipe) {
      return null;
    }

    // 포션 생성
    const potionItem = new ItemStackImpl(290, 1);
    potionItem.potionData = {
      effectType: recipe.effectType,
      duration: recipe.baseDuration,
      amplifier: recipe.baseAmplifier,
      isSplash: false
    };

    return potionItem;
  }

  // 양조대 블록 상호작용
  interactWithBrewingStand(blockX: number, blockY: number, blockZ: number, playerInventory: Inventory): void {
    const potionSlots = [
      playerInventory.getSlot(0), // 슬롯 1
      playerInventory.getSlot(1), // 슬롯 2
      playerInventory.getSlot(2)  // 슬롯 3
    ];

    const ingredientSlot = playerInventory.getSlot(3); // 재료 슬롯

    // 각 슬롯에 대해 양조 시도
    for (let i = 0; i < potionSlots.length; i++) {
      const baseItem = potionSlots[i];
      if (!baseItem) continue;

      const brewedPotion = this.brew(baseItem, ingredientSlot);
      if (brewedPotion) {
        // 베이스 아이템 소모
        playerInventory.removeStack(baseItem);

        // 포션 추가
        playerInventory.addItem(brewedPotion);

        // 재료 소모 (1개)
        ingredientSlot.count--;
        if (ingredientSlot.count <= 0) {
          playerInventory.removeStack(ingredientSlot);
        }

        showNotification("양조 완료!");
        playSound('brewing_complete');
      }
    }
  }
}
```

### PotionRecipe
```typescript
class PotionRecipe {
  private static recipes: Map<string, PotionRecipeData> = new Map();

  static initialize(): void {
    // 물병 + 넥더 와트 → 기본 포션 (Awkward Potion)
    this.addRecipe(374, 291, {
      effectType: null, // 기본 포션은 효과 없음
      baseDuration: 0,
      baseAmplifier: 0
    });

    // 기본 포션 + 거미 눈 → 포이즌 포션
    this.addRecipe(375, 292, {
      effectType: EffectType.POISON,
      baseDuration: 45,
      baseAmplifier: 0
    });

    // 기본 포션 + 설탕 → 스피드 포션
    this.addRecipe(375, 293, {
      effectType: EffectType.SPEED,
      baseDuration: 180,
      baseAmplifier: 0
    });

    // 기본 포션 + 레드스톤 → 긴 지속시간 포션
    this.addRecipe(375, 294, {
      effectType: EffectType.SPEED, // 예: 스피드 포션
      baseDuration: 480,
      baseAmplifier: 0
    });

    // 기본 포션 + 가스트 눈 → 레버 포션 (Slowness)
    this.addRecipe(375, 295, {
      effectType: EffectType.SLOWNESS,
      baseDuration: 90,
      baseAmplifier: 0
    });

    // 기본 포션 + 마그마 크림 → 파이어 레지스턴스
    // (미구현: 별도 EffectType 추가 필요)

    // 기본 포션 + 블레이즈 파우더 → 스트랭스 포션
    this.addRecipe(375, 296, {
      effectType: EffectType.STRENGTH,
      baseDuration: 180,
      baseAmplifier: 0
    });

    // 기본 포션 + 금 사과 → 힐링 포션
    this.addRecipe(375, 297, {
      effectType: EffectType.HEALING,
      baseDuration: 0, // 즉시 효과
      baseAmplifier: 0
    });

    // 기본 포션 + 황금 당근 → 나이트 비전 포션
    this.addRecipe(375, 298, {
      effectType: EffectType.NIGHT_VISION,
      baseDuration: 180,
      baseAmplifier: 0
    });

    // 기본 포션 + 물고기 → 워터 브레싱 포션
    this.addRecipe(375, 299, {
      effectType: EffectType.WATER_BREATHING,
      baseDuration: 180,
      baseAmplifier: 0
    });

    // 포이즌 포션 + 레드스톤 → 긴 포이즌
    this.addRecipe(291, 294, {
      effectType: EffectType.POISON,
      baseDuration: 120,
      baseAmplifier: 0
    });

    // 포이즌 포션 + 글로우스톤 가루 → 강한 포이즌
    this.addRecipe(291, 300, {
      effectType: EffectType.POISON,
      baseDuration: 22,
      baseAmplifier: 1
    });
  }

  private static addRecipe(baseItemId: number, ingredientItemId: number, recipe: PotionRecipeData): void {
    const key = `${baseItemId}:${ingredientItemId}`;
    this.recipes.set(key, recipe);
  }

  static getRecipe(baseItemId: number, ingredientItemId: number): PotionRecipeData | null {
    const key = `${baseItemId}:${ingredientItemId}`;
    return this.recipes.get(key) || null;
  }

  static getAllRecipes(): Map<string, PotionRecipeData> {
    return this.recipes;
  }
}

interface PotionRecipeData {
  effectType: EffectType | null;
  baseDuration: number;  // 초
  baseAmplifier: number; // 0-2
}
```

### ItemStack 확장 (포션 데이터)
```typescript
interface ItemStack {
  itemId: number;
  count: number;
  durability: number;
  maxDurability: number;
  type: ItemType;

  // 포션 데이터
  potionData: PotionData | null;

  // 포션 마시기
  drink(): void;
}

class ItemStackImpl implements ItemStack {
  itemId: number;
  count: number;
  durability: number;
  maxDurability: number;
  type: ItemType;
  potionData: PotionData | null = null;

  constructor(itemId: number, count: number) {
    this.itemId = itemId;
    this.count = count;
    this.type = this.getItemType(itemId);
    this.durability = this.getMaxDurability(itemId);
    this.maxDurability = this.durability;
  }

  private getItemType(itemId: number): ItemType {
    if (itemId === 290) return ItemType.POTION;
    if (itemId === 374) return ItemType.POTION_BASE; // Water Bottle
    if (itemId === 375) return ItemType.POTION_BASE; // Awkward Potion
    return ItemType.NONE;
  }

  private getMaxDurability(itemId: number): number {
    return 1; // 포션은 1회 사용
  }

  // 포션 마시기
  drink(): void {
    if (this.type !== ItemType.POTION || !this.potionData) {
      return;
    }

    // 효과 적용
    const effect: ActiveEffect = {
      type: this.potionData.effectType,
      duration: this.potionData.duration,
      amplifier: this.potionData.amplifier,
      startTime: Date.now()
    };

    // 플레이어에게 효과 추가 (Game에서 처리)
    // this.game.player.survival.addEffect(effect);

    // 아이템 소모
    this.count--;
    if (this.count <= 0) {
      // 아이템 제거 (인벤토리에서 처리)
    }
  }
}

enum ItemType {
  NONE = 'none',
  POTION = 'potion',
  POTION_BASE = 'potion_base',
  // ... 기존 ItemType들
}
```

### Survival 확장 (활성화된 효과)
```typescript
class Survival {
  health: number = 20;
  maxHealth: number = 20;
  hunger: number = 20;
  maxHunger: number = 20;

  // 이동 속도
  baseMoveSpeed: number = 0.1;
  moveSpeed: number = 0.1;

  // 공격력 배수
  attackDamageMultiplier: number = 1;

  // 활성화된 효과
  activeEffects: ActiveEffect[] = [];

  // 효과 플래그
  nightVisionActive: boolean = false;
  waterBreathingActive: boolean = false;

  // 효과 추가
  addEffect(effect: ActiveEffect): void {
    // 기존 효과 확인 (같은 타입이 있으면 덮어씀)
    const existingIndex = this.activeEffects.findIndex(e => e.type === effect.type);

    if (existingIndex >= 0) {
      // 증폭 레벨이 더 높거나 지속시간이 더 길 때만 덮어씀
      const existing = this.activeEffects[existingIndex];
      if (effect.amplifier >= existing.amplifier && effect.duration >= existing.duration) {
        this.activeEffects[existingIndex] = effect;
      }
    } else {
      this.activeEffects.push(effect);
    }
  }

  // 효과 업데이트 (매 프레임)
  updateEffects(deltaTime: number): void {
    // 모든 효과 적용
    for (const effect of this.activeEffects) {
      EffectSystem.applyEffect(effect, this, deltaTime);
    }

    // 만료된 효과 제거
    this.activeEffects = this.activeEffects.filter(effect => effect.duration > 0);

    // 효과 플래그 초기화
    this.nightVisionActive = false;
    this.waterBreathingActive = false;

    // 효과 플래그 설정
    for (const effect of this.activeEffects) {
      if (effect.type === EffectType.NIGHT_VISION) {
        this.nightVisionActive = true;
      }
      if (effect.type === EffectType.WATER_BREATHING) {
        this.waterBreathingActive = true;
      }
    }

    // 이동 속도 초기화 (효과가 없으면 기본 속도)
    if (this.activeEffects.length === 0 ||
        !this.activeEffects.some(e => e.type === EffectType.SPEED || e.type === EffectType.SLOWNESS)) {
      this.moveSpeed = this.baseMoveSpeed;
    }

    // 공격력 배수 초기화
    if (this.activeEffects.length === 0 ||
        !this.activeEffects.some(e => e.type === EffectType.STRENGTH)) {
      this.attackDamageMultiplier = 1;
    }
  }

  // 모든 효과 제거
  clearAllEffects(): void {
    this.activeEffects = [];
    this.moveSpeed = this.baseMoveSpeed;
    this.attackDamageMultiplier = 1;
    this.nightVisionActive = false;
    this.waterBreathingActive = false;
  }
}
```

## 핵심 로직

### 1. 양조대 상호작용
```typescript
// Game.ts 우클릭 이벤트
onRightClick(blockX, blockY, blockZ): void {
  const blockId = this.world.getBlock(blockX, blockY, blockZ);

  if (blockId === 35) {
    this.openBrewingUI();
    return;
  }
}

// 양조 UI 열기
openBrewingUI(): void {
  this.brewingUI.open(
    this.player.inventory,
    (baseItem, ingredientItem) => {
      const brewingSystem = new BrewingSystem(this.world);
      const potion = brewingSystem.brew(baseItem, ingredientItem);

      if (potion) {
        showNotification("양조 완료!");
        playSound('brewing_complete');
      } else {
        showNotification("양조 실패 (잘못된 재료)");
      }
    }
  );
}
```

### 2. 포션 마시기
```typescript
// Game.ts 아이템 사용 이벤트
onUseItem(itemStack: ItemStack): void {
  if (itemStack.type === ItemType.POTION && itemStack.potionData) {
    // 효과 적용
    const effect: ActiveEffect = {
      type: itemStack.potionData.effectType,
      duration: itemStack.potionData.duration,
      amplifier: itemStack.potionData.amplifier,
      startTime: Date.now()
    };

    this.player.survival.addEffect(effect);

    // 아이템 소모
    itemStack.count--;
    if (itemStack.count <= 0) {
      this.player.inventory.removeStack(itemStack);
    }

    showNotification(`${EffectSystem.getEffectDisplayName(effect.type)} 포션 마시기!`);
    playSound('potion_drink');

    // 빈 병 드롭
    this.player.inventory.addItem({itemId: 374, count: 1}); // Empty Bottle
  }
}
```

### 3. 효과 업데이트 루프
```typescript
// Game.ts 메인 업데이트 루프
update(deltaTime: number): void {
  super.update(deltaTime);

  // 효과 업데이트
  this.player.survival.updateEffects(deltaTime);

  // 효과 표시 UI 업데이트
  this.updateEffectDisplayUI();
}

// 효과 표시 UI 업데이트
private updateEffectDisplayUI(): void {
  const effects = this.player.survival.activeEffects;

  this.effectDisplayUI.update(effects.map(effect => ({
    name: EffectSystem.getEffectDisplayName(effect.type),
    duration: EffectSystem.formatDuration(effect.duration),
    amplifier: effect.amplifier
  })));
}
```

### 4. 야간 투시 효과 적용
```typescript
// Game.ts 렌더링 루프
render(): void {
  // 야간 투시 효과 확인
  if (this.player.survival.nightVisionActive) {
    // 앰비언트 조명 증가
    this.renderer.setAmbientLight(0.8); // 밝게
  } else {
    // 기본 앰비언트 조명
    this.renderer.setAmbientLight(0.3); // 어둡게
  }

  super.render();
}
```

### 5. 수중 호흡 효과 적용
```typescript
// Survival.ts 산소 관리
updateOxygen(deltaTime: number): void {
  // 수중 호흡 효과가 활성화되어 있으면 산소 소모 없음
  if (this.waterBreathingActive) {
    this.oxygen = 20;
    return;
  }

  // 기존 산소 관리 로직
  // ...
}
```

## 충돌/의존성
- **Inventory.ts 의존성**: 포션 아이템(290) 추가, 포션 데이터 구조. 기존 인벤토리 시스템과 호환
- **ItemStack.ts 의존성**: PotionData 필드 추가, drink() 메서드 추가. 기존 아이템 시스템과 호환
- **Survival.ts 의존성**: activeEffects 필드, 효과 적용/지속시간 감소, moveSpeed/attackDamageMultiplier 조정. 기존 생존 시스템과 호환
- **Game.ts 의존성**: 양조대 상호작용, 포션 마시기, 효과 표시 UI. 기존 블록 상호작용과 충돌하지 않도록 조건 분기
- **World.ts 의존성**: 양조대 블록(35) 지원. 기존 블록 시스템과 호환
- **충돌 위험**: 여러 효과가 동시에 적용될 때 moveSpeed/attackDamageMultiplier가 중복 계산될 수 있음. updateEffects()에서 초기화 로직 필요
- **밸런스 고려**: 포이즌 효과가 너무 강하면 게임 불가능. 데미지 속도와 지속시간 조정 필요

## 테스트 방법

### 1. 단위 테스트 (BrewingSystem.test.ts)
```typescript
describe('BrewingSystem', () => {
  test('should brew poison potion', () => {
    const world = new World();
    const brewingSystem = new BrewingSystem(world);

    const baseItem = new ItemStackImpl(375, 1); // Awkward Potion
    const ingredientItem = new ItemStackImpl(292, 1); // Spider Eye

    const potion = brewingSystem.brew(baseItem, ingredientItem);

    expect(potion).not.toBeNull();
    expect(potion!.itemId).toBe(290); // Potion
    expect(potion!.potionData!.effectType).toBe(EffectType.POISON);
    expect(potion!.potionData!.duration).toBe(45);
  });

  test('should brew speed potion', () => {
    const world = new World();
    const brewingSystem = new BrewingSystem(world);

    const baseItem = new ItemStackImpl(375, 1); // Awkward Potion
    const ingredientItem = new ItemStackImpl(293, 1); // Sugar

    const potion = brewingSystem.brew(baseItem, ingredientItem);

    expect(potion).not.toBeNull();
    expect(potion!.potionData!.effectType).toBe(EffectType.SPEED);
    expect(potion!.potionData!.duration).toBe(180);
  });

  test('should not brew with invalid ingredients', () => {
    const world = new World();
    const brewingSystem = new BrewingSystem(world);

    const baseItem = new ItemStackImpl(375, 1); // Awkward Potion
    const ingredientItem = new ItemStackImpl(1, 1); // Stone (invalid)

    const potion = brewingSystem.brew(baseItem, ingredientItem);

    expect(potion).toBeNull();
  });
});

describe('EffectSystem', () => {
  test('should apply speed effect', () => {
    const survival = new Survival();
    const effect: ActiveEffect = {
      type: EffectType.SPEED,
      duration: 10,
      amplifier: 1,
      startTime: Date.now()
    };

    EffectSystem.applyEffect(effect, survival, 0.016);

    expect(survival.moveSpeed).toBe(survival.baseMoveSpeed * 1.2); // 20% 증가
  });

  test('should apply poison effect', () => {
    const survival = new Survival();
    survival.health = 20;
    const effect: ActiveEffect = {
      type: EffectType.POISON,
      duration: 10,
      amplifier: 0,
      startTime: Date.now()
    };

    EffectSystem.applyEffect(effect, survival, 1); // 1초 경과

    expect(survival.health).toBeLessThan(20); // 데미지 감소
  });

  test('should apply healing effect', () => {
    const survival = new Survival();
    survival.health = 10;
    const effect: ActiveEffect = {
      type: EffectType.HEALING,
      duration: 10,
      amplifier: 0,
      startTime: Date.now()
    };

    EffectSystem.applyEffect(effect, survival, 1); // 1초 경과

    expect(survival.health).toBeGreaterThan(10); // 체력 회복
    expect(survival.health).toBeLessThanOrEqual(20); // 최대 체력 초과 안 함
  });
});

describe('Survival', () => {
  test('should add and update effects', () => {
    const survival = new Survival();
    const effect: ActiveEffect = {
      type: EffectType.SPEED,
      duration: 5,
      amplifier: 1,
      startTime: Date.now()
    };

    survival.addEffect(effect);

    expect(survival.activeEffects.length).toBe(1);

    survival.updateEffects(1); // 1초 경과

    expect(survival.activeEffects[0].duration).toBe(4); // 5 - 1 = 4
    expect(survival.moveSpeed).toBe(survival.baseMoveSpeed * 1.2); // Speed 효과 적용
  });

  test('should remove expired effects', () => {
    const survival = new Survival();
    const effect: ActiveEffect = {
      type: EffectType.SPEED,
      duration: 1,
      amplifier: 1,
      startTime: Date.now()
    };

    survival.addEffect(effect);
    survival.updateEffects(2); // 2초 경과 (지속시간 초과)

    expect(survival.activeEffects.length).toBe(0); // 효과 제거됨
    expect(survival.moveSpeed).toBe(survival.baseMoveSpeed); // 기본 속도로 복귀
  });
});
```

### 2. 통합 테스트
- 양조 레시피: 올바른 재료 조합으로 포션이 제조되는지 확인
- 포션 효과 적용: 포션 마시기 후 올바른 효과가 발동되는지 확인
- 효과 지속시간: 효과가 지정된 시간 동안 유지되는지 확인
- 효과 중첩: 같은 타입의 효과가 덮어씌워지는지 확인
- 효과 종료: 지속시간 만료 후 효과가 제거되는지 확인
- Speed 효과: 이동 속도가 올바르게 증가/감소하는지 확인
- Strength 효과: 공격력이 올바르게 증가하는지 확인
- Poison 효과: 체력이 올바르게 감소하는지 확인
- Healing 효과: 체력이 올바르게 회복되는지 확인
- NightVision 효과: 야간 투시가 올바르게 활성화되는지 확인
- WaterBreathing 효과: 수중 호흡이 올바르게 활성화되는지 확인

### 3. 수동 테스트 시나리오
1. 양조대(35) 설치
2. 양조대 우클릭으로 양조 UI 열기
3. 슬롯 1에 물병(374) 넣기
4. 재료 슬롯에 넥더 와트(291) 넣기
5. 양조 완료 후 기본 포션(375) 확인
6. 슬롯 1에 기본 포션 넣기
7. 재료 슬롯에 설탕(293) 넣기
8. 양조 완료 후 스피드 포션 확인
9. 스피드 포션 마시기
10. 이동 속도 증가 확인 (기본 0.1 → 1.2배)
11. 3분(180초) 후 효과 종료 확인
12. 다시 슬롯 1에 기본 포션 넣기
13. 재료 슬롯에 거미 눈(292) 넣기
14. 양조 완료 후 포이즌 포션 확인
15. 포이즌 포션 마시기
16. 체력 감소 확인 (초당 0.5)
17. 45초 후 효과 종료 확인
18. 다시 슬롯 1에 기본 포션 넣기
19. 재료 슬롯에 블레이즈 파우더(296) 넣기
20. 양조 완료 후 스트랭스 포션 확인
21. 스트랭스 포션 마시기
22. 몹 공격 시 데미지 증가 확인
23. 3분 후 효과 종료 확인
24. 다시 슬롯 1에 기본 포션 넣기
25. 재료 슬롯에 금 사과(297) 넣기
26. 양조 완료 후 힐링 포션 확인
27. 힐링 포션 마시기
28. 체력 즉시 회복 확인
29. 다시 슬롯 1에 기본 포션 넣기
30. 재료 슬롯에 황금 당근(298) 넣기
31. 양조 완료 후 나이트 비전 포션 확인
32. 나이트 비전 포션 마시기
33. 야간 투시 활성화 확인 (어두운 곳에서도 잘 보임)
34. 3분 후 효과 종료 확인
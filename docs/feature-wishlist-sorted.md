# 🎮 LbinCraft 기능 위시리스트 — 구현 난이도순 정렬

> 원본: `docs/feature-wishlist.md`  
> 정렬 기준: 구현 난이도 (낮은 것부터) + 의존성 고려  
> 작성일: 2026-06-15

---

## 정렬 원칙

1. **난이도 우선**: ⭐⭐ → ⭐⭐⭐ → ⭐⭐⭐⭐ → ⭐⭐⭐⭐⭐
2. **의존성 조정**: 선행 기능이 필요한 경우 순서를 앞당김
3. **슈퍼맨 모드**: 이미 설계서가 작성되어 별도 처리 (11번)

---

## ⭐⭐ 쉬움 (4개)

| 구현 순서 | 기능 | 설계서 | 의존성 | 비고 |
|-----------|------|--------|--------|------|
| 12 | 유리창 (Glass) | `12-glass-block.md` | 없음 | 투명 렌더링 이미 Ice로 검증됨 |
| 13 | 백팩 (Backpack) | `13-backpack.md` | 없음 | 인벤토리 슬롯 확장만 |
| 14 | 트램펄린 (Trampoline) | `14-trampoline.md` | 없음 | 충돌 시 velocity.y 반동 |
| 15 | 눈덩이 던지기 (Snowball) | `15-snowball.md` | 없음 | 투사체 + 설원 바이옴 |

## ⭐⭐⭐ 보통 (8개)

| 구현 순서 | 기능 | 설계서 | 의존성 | 비고 |
|-----------|------|--------|--------|------|
| 16 | 문 (Door) | `16-door.md` | 없음 | 2블록 높이 회전 메시 |
| 17 | 블록 염색 (Dye) | `17-dye-system.md` | #12 Glass (유리병) | 색상 데이터를 BlockType에 확장 |
| 18 | 보물 상자 (Chest) | `18-chest.md` | 없음 | 블록 상태 저장 (NBT 대체) |
| 19 | 보물 지도 (Map) | `19-treasure-map.md` | #18 Chest | 지도 아이템 + 렌더링 |
| 20 | 갈고리 (Grappling Hook) | `20-grappling-hook.md` | 없음 | 레이캐스트 + 물리 이동 |
| 21 | 늑대 길들이기 (Pet Wolf) | `21-pet-wolf.md` | 없음 | Entity 상속 + AI |
| 22 | 낚시 (Fishing) | `22-fishing.md` | 없음 | 투사체 + 타이머 |
| 23 | 폭죽 (Fireworks) | `23-fireworks.md` | 없음 | 파티클 + 절차적 사운드 |

## ⭐⭐⭐⭐ 어려움 (7개)

| 구현 순서 | 기능 | 설계서 | 의존성 | 비고 |
|-----------|------|--------|--------|------|
| 24 | 계단 블록 (Stairs) | `24-stairs.md` | 없음 | 커스텀 메시 + 충돌 |
| 25 | 던전 (Dungeon) | `25-dungeon.md` | #18 Chest | 구조물 생성 알고리즘 |
| 26 | 갑옷 시스템 (Armor) | `26-armor.md` | #14 Crafting | 장비 슬롯 + 데미지 감소 |
| 27 | 활과 화살 (Bow) | `27-bow-arrow.md` | 없음 | 차지 타이머 + 투사체 궤적 |
| 28 | 화산 바이옴 (Volcano) | `28-volcano-biome.md` | 없음 | 용암 블록 + 바이옴 노이즈 |
| 29 | 말 타기 (Horse Riding) | `29-horse-riding.md` | #21 Pet AI | Entity 탑승 + 카메라 |
| 30 | 레일카트 (Minecart) | `30-minecart.md` | #24 Stairs(경사) | 레일 블록 + 경로 따라가기 |

## ⭐⭐⭐⭐⭐ 매우 어려움 (6개)

| 구현 순서 | 기능 | 설계서 | 의존성 | 비고 |
|-----------|------|--------|--------|------|
| 31 | 구조물 복사 (Copy & Paste) | `31-copy-paste.md` | 없음 | 영역 선택 + 블록 직렬화 |
| 32 | 보스 드래곤 (Boss Dragon) | `32-boss-dragon.md` | #27 Bow | 대형 엔티티 + 페이즈 AI |
| 33 | NPC 마을 (Village) | `33-npc-village.md` | #18 Chest, #16 Door | 구조물 생성 + NPC AI |
| 34 | 차원 포탈 (Portal) | `34-dimension-portal.md` | #28 Volcano | 월드 인스턴스 분리 |
| 35 | 마법 부여 (Enchanting) | `35-enchanting.md` | #26 Armor | 속성 시스템 + UI |
| 36 | 포션 (Potion Brewing) | `36-potion-brewing.md` | #22 Fishing(재료) | 상태이상 시스템 |

---

## 전체 의존성 그래프

```
#11 Superman (독립)
#12 Glass (독립)
#13 Backpack (독립)
#14 Trampoline (독립)
#15 Snowball (독립)
#16 Door (독립)
#17 Dye ← #12 Glass (유리병)
#18 Chest (독립)
#19 Map ← #18 Chest
#20 Grappling Hook (독립)
#21 Pet Wolf (독립)
#22 Fishing (독립)
#23 Fireworks (독립)
#24 Stairs (독립)
#25 Dungeon ← #18 Chest
#26 Armor ← Crafting 시스템
#27 Bow (독립)
#28 Volcano (독립)
#29 Horse ← #21 Pet AI
#30 Minecart ← #24 Stairs
#31 Copy Paste (독립)
#32 Dragon ← #27 Bow (원거리 전투)
#33 Village ← #18 Chest, #16 Door
#34 Portal ← #28 Volcano (넥더 석재)
#35 Enchanting ← #26 Armor
#36 Potion ← #22 Fishing (재료)
```

---

## 추천 구현 순서 (탑 10 빠른 승리)

| 우선순위 | 기능 | 난이도 | 이유 |
|----------|------|--------|------|
| 1 | 슈퍼맨 모드 (#11) | ⭐⭐⭐ | 설계서 완성, 플레이어 물리만 수정 |
| 2 | 트램펄린 (#14) | ⭐⭐ | 충돌 1곳 수정, 즉각적 재미 |
| 3 | 눈덩이 던지기 (#15) | ⭐⭐ | 투사체 시스템 도입, 폭죽의 기반 |
| 4 | 유리창 (#12) | ⭐⭐ | 블록 1개 추가, 투명 렌더링 이미 구현됨 |
| 5 | 백팩 (#13) | ⭐⭐ | 인벤토리 슬롯 수만 변경 |
| 6 | 폭죽 (#23) | ⭐⭐⭐ | 파티클 + 사운드로 시각/청각 임팩트 |
| 7 | 갈고리 (#20) | ⭐⭐⭐ | 레이캐스트 기반, 스파이더맨 느낌 |
| 8 | 보물 상자 (#18) | ⭐⭐⭐ | 블록 상태 저장의 기반 |
| 9 | 늑대 길들이기 (#21) | ⭐⭐⭐ | Entity AI 확장, 전투 파트너 |
| 10 | 문 (#16) | ⭐⭐⭐ | 건축의 핵심, 회전 애니메이션 |

---

*총 26개 기능 (슈퍼맨 모드 포함)*

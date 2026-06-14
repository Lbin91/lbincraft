# VoxelCraft Feature Roadmap

> 10개 기능을 난이도 쉬운 것부터 어려운 것 순서로 정렬.

## 구현 순서

| 순서 | 기능 | 난이도 | 예상 시간 | 문서 | 의존성 |
|------|------|--------|----------|------|--------|
| 1 | Block Highlight Outline | ⭐ S | 30분 | [01](./01-block-highlight.md) | 없음 |
| 2 | Break Particle Effects | ⭐ S | 45분 | [02](./02-break-particles.md) | 없음 |
| 3 | Day/Night Cycle | ⭐ S | 1시간 | [03](./03-day-night-cycle.md) | 없음 |
| 4 | Falling Blocks | ⭐⭐ M | 1.5시간 | [04](./04-falling-blocks.md) | 없음 |
| 5 | Caves | ⭐⭐ M | 2시간 | [05](./05-caves.md) | 없음 |
| 6 | Biomes | ⭐⭐ M | 2.5시간 | [06](./06-biomes.md) | 없음 |
| 7 | Inventory + Crafting | ⭐⭐ M | 3시간 | [07](./07-inventory-crafting.md) | 없음 |
| 8 | Minerals + Smelting | ⭐⭐⭐ L | 4시간 | [08](./08-minerals-smelting.md) | #07 |
| 9 | Health/Hunger Survival | ⭐⭐⭐ L | 4시간 | [09](./09-health-hunger.md) | 없음 (독립 가능) |
| 10 | Animals / Mobs | ⭐⭐⭐ L | 6시간 | [10](./10-animals-mobs.md) | #03, #09 |

## 총 예상 시간

- **Small (1-3)**: ~2.5시간
- **Medium (4-7)**: ~9시간
- **Large (8-10)**: ~14시간
- **전체**: ~25.5시간

## 의존성 그래프

```
#01 Block Highlight  ──── (독립)
#02 Break Particles  ──── (독립)
#03 Day/Night        ──── (독립) ──────────────→ #10 Mobs (밤 스폰)
#04 Falling Blocks   ──── (독립)
#05 Caves            ──── (독립)
#06 Biomes           ──── (독립)
#07 Inventory        ──── (독립) ──→ #08 Minerals (아이템 획득)
#08 Minerals         ──── (#07)
#09 Health/Hunger    ──── (독립) ──→ #10 Mobs (데미지)
#10 Animals/Mobs     ──── (#03, #09)
```

## 구현 원칙

1. **순차 진행**: 1번부터 10번까지 순서대로 구현
2. **각 기능별 커밋**: 구현 완료 시마다 커밋
3. **브라우저 검증**: 각 기능 구현 후 Playwright로 동작 확인
4. **타입 안정성**: `as any` / `@ts-ignore` 금지
5. **성능 유지**: 모든 기능 추가 후 60fps 유지

## Oracle 검토 반영 (피드백 수용 결과)

| Feature | 수용 항목 | 연기 항목 |
|---------|----------|----------|
| #01 | 성능 근거 표현 수정 | - |
| #02 | `transparent`/`depthWrite` 추가, 상한 100 | InstancedMesh 전환 |
| #03 | In-place Color 갱신 가이드 | - |
| #04 | 언로드 청크 가드, markDirty 호출 | - |
| #05 | 별도 PRNG 인스턴스 | - |
| #06 | Snow/Ice 블록, Bilinear blending | - |
| #07 | ItemId 타입, HOTBAR 마이그레이션 | Crafting 회전 매칭 |
| #08 | 결정론적 광물 생성, ItemId | - |
| #09 | 물 감지 로직, Y기반 낙하 추적 | 수영 물리 정교화 |
| #10 | Physics 범용화, 기본 애니메이션 | InstancedMesh 드로우 콜 |

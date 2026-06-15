# 구조물 복사 및 붙여넣기 기능 (Copy-Paste)

## 개요
LbinCraft 월드 내에서 선택한 구조물을 복사하고 다른 위치에 붙여넣는 기능을 구현합니다. 플레이어는 마우스 클릭으로 두 점을 선택하여 AABB(축 정렬 경계 상자) 영역을 정의하고, 이 영역의 모든 블록을 복사본으로 저장한 후 원하는 위치에 붙여넣을 수 있습니다. 이 기능은 건물 복제, 구조물 백업, 효율적인 건설 등에 활용됩니다.

## 구현 범위
- 영역 선택 UI 및 상호작용 (두 점 클릭으로 AABB 정의)
- ClipboardManager 클래스로 복사 데이터 관리
- 선택 영역의 블록 데이터 직렬화 (Uint8Array)
- 붙여넣기 로직 (위치 오프셋 적용, 충돌 체크)
- 복사 크기 제한 (32x32x32 최대)
- 선택 영역 시각화 (와이어프레임 박스 렌더링)

## 수정 대상 파일
- `Game.ts` - 클릭 이벤트 핸들러에 복사/붙여넣기 키 바인딩 추가 (Ctrl+C, Ctrl+V)
- `World.ts` - 대량 블록 설정을 위한 최적화된 setBlocks() 메서드 추가
- `MeshBuilder.ts` - 선택 영역 와이어프레임 생성 메서드 추가

## 추가 파일
- `ClipboardManager.ts` - 선택 및 복사본 데이터 관리
- `ClipboardManager.test.ts` - 단위 테스트

## 데이터 구조

### ClipboardManager
```typescript
class ClipboardManager {
  private selectionStart: {x, y, z} | null;
  private selectionEnd: {x, y, z} | null;
  private clipboard: Uint8Array | null;
  private clipboardSize: {width, height, depth} | null;

  // 선택 시작
  startSelection(x, y, z): void

  // 선택 종료 및 직렬화
  endSelection(world: World): boolean {
    if (!this.selectionStart) return false;
    const aabb = this.calculateAABB(this.selectionStart, this.selectionEnd);
    const size = this.calculateSize(aabb);

    // 크기 제한 체크
    if (size.width > 32 || size.height > 32 || size.depth > 32) {
      return false; // 최대 크기 초과
    }

    // 직렬화
    this.clipboard = new Uint8Array(size.width * size.height * size.depth);
    this.clipboardSize = size;

    let index = 0;
    for (let y = aabb.minY; y <= aabb.maxY; y++) {
      for (let z = aabb.minZ; z <= aabb.maxZ; z++) {
        for (let x = aabb.minX; x <= aabb.maxX; x++) {
          this.clipboard[index++] = world.getBlock(x, y, z);
        }
      }
    }

    this.selectionStart = null;
    this.selectionEnd = null;
    return true;
  }

  // 붙여넣기
  paste(world: World, targetX, targetY, targetZ): boolean {
    if (!this.clipboard || !this.clipboardSize) return false;

    const {width, height, depth} = this.clipboardSize;
    let index = 0;

    for (let dy = 0; dy < height; dy++) {
      for (let dz = 0; dz < depth; dz++) {
        for (let dx = 0; dx < width; dx++) {
          const blockId = this.clipboard[index++];
          const x = targetX + dx;
          const y = targetY + dy;
          const z = targetZ + dz;
          world.setBlock(x, y, z, blockId);
        }
      }
    }

    return true;
  }

  // AABB 계산
  private calculateAABB(p1, p2): {minX, maxX, minY, maxY, minZ, maxZ} {
    return {
      minX: Math.min(p1.x, p2.x),
      maxX: Math.max(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y),
      maxY: Math.max(p1.y, p2.y),
      minZ: Math.min(p1.z, p2.z),
      maxZ: Math.max(p1.z, p2.z)
    };
  }

  // 크기 계산
  private calculateSize(aabb): {width, height, depth} {
    return {
      width: aabb.maxX - aabb.minX + 1,
      height: aabb.maxY - aabb.minY + 1,
      depth: aabb.maxZ - aabb.minZ + 1
    };
  }
}
```

## 핵심 로직

### 1. 선택 영역 정의
```typescript
// Game.ts 클릭 이벤트 핸들러
onRightClick(blockX, blockY, blockZ): void {
  if (keyboardCtrlPressed) {
    if (!clipboard.selectionStart) {
      // 첫 번째 클릭: 선택 시작
      clipboard.startSelection(blockX, blockY, blockZ);
      renderSelectionBox(blockX, blockY, blockZ, 1, 1, 1);
    } else {
      // 두 번째 클릭: 선택 종료 및 복사
      clipboard.endSelection(world);
      renderSelectionBox(null); // 숨기기
      showNotification("구조물 복사됨");
    }
  }
}
```

### 2. 붙여넣기 실행
```typescript
// Game.ts 키보드 이벤트
onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'v' && keyboardCtrlPressed && clipboard.hasClipboard()) {
    // 플레이어 시선 방향으로 붙여넣기 위치 결정
    const pastePos = calculatePastePosition(playerPosition, playerLookDirection);
    const success = clipboard.paste(world, pastePos.x, pastePos.y, pastePos.z);
    if (success) {
      showNotification("구조물 붙여넣기 완료");
      world.markModified(pastePos.x, pastePos.y, pastePos.z);
      world.saveToLocalStorage();
    }
  }
}
```

### 3. 선택 영역 시각화
```typescript
// MeshBuilder.ts
createSelectionBox(minX, minY, minZ, width, height, depth): THREE.LineSegments {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const box = new THREE.LineSegments(edges, material);
  box.position.set(
    minX + width / 2,
    minY + height / 2,
    minZ + depth / 2
  );
  return box;
}
```

### 4. 대량 블록 설정 최적화
```typescript
// World.ts
setBlocks(blocks: {x, y, z, blockId}[]): void {
  const modifiedChunks = new Set<string>();

  for (const block of blocks) {
    const {x, y, z, blockId} = block;
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);
    const chunkKey = `${chunkX},${chunkZ}`;

    this.setBlock(x, y, z, blockId);
    modifiedChunks.add(chunkKey);
  }

  // 수정된 청크만 메시 재생성
  for (const chunkKey of modifiedChunks) {
    const [cx, cz] = chunkKey.split(',').map(Number);
    this.rebuildChunkMesh(cx, cz);
  }
}
```

## 충돌/의존성
- **World.ts 의존성**: ClipboardManager는 World의 getBlock/setBlock 메서드를 사용합니다. setBlocks() 최적화를 위해 World 수정 필요
- **Game.ts 의존성**: 클릭 이벤트와 키보드 이벤트 핸들러에 통합해야 함
- **MeshBuilder.ts 의존성**: 선택 영역 시각화를 위해 와이어프레임 생성 로직 추가
- **충돌 위험**: Ctrl+C/Ctrl+V가 기존 키바인딩과 충돌하지 않는지 확인 필요 (인벤토리 닫기 등)
- **월드 지속성**: 붙여넣기 후 World.saveToLocalStorage() 호출하여 수정 사항 저장

## 테스트 방법

### 1. 단위 테스트 (ClipboardManager.test.ts)
```typescript
describe('ClipboardManager', () => {
  test('should copy 1x1x1 block', () => {
    world.setBlock(10, 10, 10, 1); // Stone
    clipboard.startSelection(10, 10, 10);
    clipboard.endSelection(world);
    expect(clipboard.hasClipboard()).toBe(true);
  });

  test('should reject oversized selection', () => {
    clipboard.startSelection(0, 0, 0);
    clipboard.selectionEnd = {x: 40, y: 0, z: 0}; // 41x1x1 > 32 limit
    const result = clipboard.endSelection(world);
    expect(result).toBe(false);
  });

  test('should paste at correct offset', () => {
    world.setBlock(5, 5, 5, 2); // Grass
    clipboard.startSelection(5, 5, 5);
    clipboard.endSelection(world);
    clipboard.paste(world, 10, 10, 10);
    expect(world.getBlock(10, 10, 10)).toBe(2);
  });

  test('should preserve block order', () => {
    // 2x2x2 패턴 생성
    world.setBlock(0, 0, 0, 1);
    world.setBlock(1, 0, 0, 2);
    world.setBlock(0, 1, 0, 3);
    world.setBlock(1, 1, 0, 4);
    clipboard.startSelection(0, 0, 0);
    clipboard.selectionEnd = {x: 1, y: 1, z: 0};
    clipboard.endSelection(world);
    clipboard.paste(world, 10, 10, 10);
    expect(world.getBlock(10, 10, 10)).toBe(1);
    expect(world.getBlock(11, 10, 10)).toBe(2);
    expect(world.getBlock(10, 11, 10)).toBe(3);
    expect(world.getBlock(11, 11, 10)).toBe(4);
  });
});
```

### 2. 통합 테스트
- 32x32x32 최대 크기 선택 시 메모리 사용량 확인
- 다른 청크에 걸친 선택 및 붙여넣기 동작 검증
- 붙여넣기 후 localStorage에 올바르게 저장되는지 확인
- 여러 번 반복 복사/붙여넣기 시 데이터 무결성 확인

### 3. 수동 테스트 시나리오
1. 3x3x3 집 구조물을 빈 공간에 지음
2. Ctrl+C로 첫 번째 클릭 (한 모서리)
3. 대각선 반대 모서리에 Ctrl+C로 두 번째 클릭 → 복사 완료 메시지 확인
4. 다른 위치로 이동하여 Ctrl+V → 구조물이 올바르게 붙여넣어지는지 확인
5. 33x1x1 구조물 선택 시 크기 제한 메시지가 표시되는지 확인
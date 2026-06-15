# 눈덩이 던지기 구현 설계

## 개요

눈덩이 던지기는 설원 지형에서 Snow 블록을 부수면 얻을 수 있는 Snowball 아이템을 사용하여 투사체를 발사하는 기능입니다. 눈덩이는 포물선 궤적을 그리며 날아가고, 엔티티 또는 블록에 충돌 시 소멸합니다. 엔티티에 명중하면 1 데미지(좀비는 0.5 데미지)를 입히며, 던질 때 짧은 휘파람 소리가 재생됩니다.

## 구현 범위

- Items 열거형에 Snowball(264) 아이템 추가
- Snow 블록 파괴 시 Snowball 아이템 드롭 로직
- ProjectileEntity 클래스 구현 (투사체 물리 시뮬레이션)
- 우클릭으로 눈덩이 투척 로직
- 엔티티 충돌 시 데미지 적용
- 블록 충돌 시 파티클 효과 및 소멸
- AudioManager에 눈덩이 투척/충돌 사운드 추가

## 수정 대상 파일

### 1. `Items.ts`
```
enum Items {
    IronIngot = 256,
    GoldIngot = 257,
    Diamond = 258,
    Stick = 259,
    WoodPlank = 260,
    StoneTool = 261,
    Leather = 262,
    Backpack = 263,
    Snowball = 264,      // 신규 추가
}

export function getItemName(itemId: number): string {
    const names = {
        256: 'Iron Ingot',
        257: 'Gold Ingot',
        258: 'Diamond',
        259: 'Stick',
        260: 'Wood Plank',
        261: 'Stone Tool',
        262: 'Leather',
        263: 'Backpack',
        264: 'Snowball',  // 추가
    };
    return names[itemId] || 'Unknown';
}

export function getStackable(itemId: number): boolean {
    // 눈덩이는 16개까지 스태킹 가능
    return itemId === 264 ? true : itemId < 300;
}
```

### 2. `World.ts`
```
class World {
    // 블록 파괴 시 아이템 드롭 로직
    breakBlock(x: number, y: number, z: number): void {
        const blockId = this.getBlock(x, y, z);

        if (blockId === BlockId.Air) {
            return;
        }

        const blockType = BLOCK_REGISTRY[blockId];

        // Snow 블록 파괴 시 Snowball 드롭
        if (blockId === BlockId.Snow) {
            // 랜덤으로 1-4개 Snowball 드롭
            const dropCount = Math.floor(Math.random() * 4) + 1;
            Inventory.addItem(264, dropCount);  // Snowball itemId

            // 파티클 효과
            ParticleSystem.spawnSnowParticles(x, y, z);
        }

        // 다른 블록 파괴 로직 유지
        // ...

        this.setBlock(x, y, z, BlockId.Air);
    }
}
```

### 3. `ProjectileEntity.ts` (신규 파일)
```
import { Entity } from './Entity';

const PROJECTILE_GRAVITY = -15;  // 일반 중력 -30의 절반
const INITIAL_VELOCITY = 20;     // 20m/s 초기 속도
const LIFETIME = 5.0;            // 5초 후 자동 소멸

class ProjectileEntity extends Entity {
    public readonly ownerId: number;  // 소유자 플레이어 ID
    public readonly itemType: number; // Snowball=264
    private lifetime: number;
    private damage: number;

    constructor(position: Vector3, velocity: Vector3, ownerId: number, itemType: number) {
        super();

        this.position = position.clone();
        this.velocity = velocity.clone();
        this.ownerId = ownerId;
        this.itemType = itemType;
        this.lifetime = LIFETIME;
        this.damage = 1.0;  // 기본 1 데미지

        this.rotation.set(0, 0, 0);
        this.scale.set(0.3, 0.3, 0.3);  // 작은 크기
    }

    update(deltaTime: number): void {
        // 수평 속도 유지, 수직 속도에 중력 적용
        this.velocity.y += PROJECTILE_GRAVITY * deltaTime;

        // 위치 업데이트
        this.position.add(
            this.velocity.clone().multiplyScalar(deltaTime)
        );

        // 수명 감소
        this.lifetime -= deltaTime;

        // 수명 종료 시 소멸
        if (this.lifetime <= 0) {
            EntityManager.removeEntity(this);
            return;
        }

        // 충돌 감지
        this.checkCollisions();
    }

    checkCollisions(): void {
        // 블록 충돌 감지
        const blockCollision = this.checkBlockCollision();
        if (blockCollision) {
            this.onBlockCollision(blockCollision);
            return;
        }

        // 엔티티 충돌 감지
        const entityCollision = this.checkEntityCollision();
        if (entityCollision) {
            this.onEntityCollision(entityCollision);
            return;
        }
    }

    checkBlockCollision(): BlockCollision | null {
        const blockSize = 1.0;
        const halfSize = blockSize / 2;

        // 현재 위치의 블록 좌표 계산
        const blockX = Math.floor(this.position.x);
        const blockY = Math.floor(this.position.y);
        const blockZ = Math.floor(this.position.z);

        // 주변 3x3x3 블록 확인
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const checkX = blockX + dx;
                    const checkY = blockY + dy;
                    const checkZ = blockZ + dz;

                    const blockId = World.getBlock(checkX, checkY, checkZ);

                    if (blockId !== BlockId.Air && blockId !== BlockId.Water) {
                        const blockType = BLOCK_REGISTRY[blockId];

                        if (blockType.solid) {
                            // 블록 AABB와 투사체 AABB 충돌 확인
                            const blockAABB = {
                                min: new Vector3(checkX, checkY, checkZ),
                                max: new Vector3(checkX + 1, checkY + 1, checkZ + 1),
                            };

                            const projectileAABB = {
                                min: this.position.clone().sub(new Vector3(halfSize, halfSize, halfSize)),
                                max: this.position.clone().add(new Vector3(halfSize, halfSize, halfSize)),
                            };

                            if (this.aabbIntersect(blockAABB, projectileAABB)) {
                                return {
                                    blockId,
                                    position: new Vector3(checkX, checkY, checkZ),
                                    normal: this.calculateCollisionNormal(blockAABB, projectileAABB),
                                };
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    checkEntityCollision(): Entity | null {
        const entities = EntityManager.getEntities();

        for (const entity of entities) {
            if (entity.id === this.id) {
                continue;  // 자기 자신 제외
            }

            if (entity.id === this.ownerId) {
                continue;  // 소유자 제외
            }

            // 엔티티 AABB 확인
            const entityAABB = entity.getAABB();
            const projectileAABB = {
                min: this.position.clone().sub(new Vector3(0.15, 0.15, 0.15)),
                max: this.position.clone().add(new Vector3(0.15, 0.15, 0.15)),
            };

            if (this.aabbIntersect(entityAABB, projectileAABB)) {
                return entity;
            }
        }

        return null;
    }

    onBlockCollision(collision: BlockCollision): void {
        // 파티클 효과
        ParticleSystem.spawnImpactParticles(this.position, 'snow');

        // 사운드
        AudioManager.play('snowball-hit');

        // 엔티티 소멸
        EntityManager.removeEntity(this);
    }

    onEntityCollision(entity: Entity): void {
        // 데미지 계산 (좀비는 절반 데미지)
        let actualDamage = this.damage;

        if (entity.type === 'Zombie') {
            actualDamage = 0.5;
        }

        entity.takeDamage(actualDamage);

        // 파티클 효과
        ParticleSystem.spawnImpactParticles(this.position, 'snow');

        // 사운드
        AudioManager.play('snowball-hit');

        // 엔티티 소멸
        EntityManager.removeEntity(this);
    }

    private aabbIntersect(a: { min: Vector3, max: Vector3 }, b: { min: Vector3, max: Vector3 }): boolean {
        return (a.min.x <= b.max.x && a.max.x >= b.min.x) &&
               (a.min.y <= b.max.y && a.max.y >= b.min.y) &&
               (a.min.z <= b.max.z && a.max.z >= b.min.z);
    }

    private calculateCollisionNormal(blockAABB: any, projectileAABB: any): Vector3 {
        // 충돌면 법선 계산 (생략)
        return new Vector3(0, 1, 0);
    }
}
```

### 4. `EntityManager.ts`
```
class EntityManager {
    private entities: Entity[] = [];

    addEntity(entity: Entity): void {
        this.entities.push(entity);
    }

    removeEntity(entity: Entity): void {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
    }

    getEntities(): Entity[] {
        return this.entities;
    }

    update(deltaTime: number): void {
        for (const entity of this.entities) {
            entity.update(deltaTime);
        }
    }
}
```

### 5. `Controls.ts`
```
class Controls {
    private keys: Record<string, boolean> = {};

    handleSnowballThrow(player: Player): void {
        // 우클릭 감지
        if (this.keys['MouseRight'] && this.keys['MouseRight'] !== this.lastMouseRight) {
            this.lastMouseRight = this.keys['MouseRight'];

            const inventory = player.getInventory();
            const selectedSlot = inventory.getSelectedSlot();

            // 선택된 아이템이 Snowball인지 확인
            if (!selectedSlot || selectedSlot.itemId !== 264) {
                return;  // 눈덩이 아님
            }

            // 눈덩이 소비
            selectedSlot.count -= 1;
            if (selectedSlot.count === 0) {
                inventory.setSelectedSlot(null);
            }

            // 투사체 생성
            this.throwSnowball(player);

            // 사운드 재생
            AudioManager.play('snowball-throw');
        }
    }

    throwSnowball(player: Player): void {
        // 플레이어 카메라 방향 계산
        const camera = player.getCamera();
        const direction = camera.getWorldDirection(new Vector3());

        // 눈높이에서 투사체 생성
        const spawnPosition = player.position.clone();
        spawnPosition.y += 1.6;  // 눈높이

        // 초기 속도 계산 (방향 * 속도)
        const velocity = direction.clone().multiplyScalar(INITIAL_VELOCITY);
        velocity.y += 2.0;  // 약간 위쪽으로 발사

        // ProjectileEntity 생성
        const projectile = new ProjectileEntity(
            spawnPosition,
            velocity,
            player.id,
            264  // Snowball
        );

        // EntityManager에 추가
        EntityManager.getInstance().addEntity(projectile);
    }
}
```

### 6. `AudioManager.ts`
```
class AudioManager {
    private static sounds: Record<string, AudioBuffer> = {};

    static async loadAllSounds(): Promise<void> {
        // 눈덩이 던지는 소리 (짧은 휘파람)
        this.sounds['snowball-throw'] = await loadSound('sounds/snowball-throw.wav');

        // 눈덩이 충돌 소리 (파지직)
        this.sounds['snowball-hit'] = await loadSound('sounds/snowball-hit.wav');
    }

    static play(soundName: string, volume: number = 1.0): void {
        const audioBuffer = this.sounds[soundName];

        if (!audioBuffer) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }

        const source = this.context.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = this.context.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.context.destination);

        source.start(0);
    }
}
```

### 7. `MeshBuilder.ts`
```
class MeshBuilder {
    // 투사체 메시 생성
    static createProjectileMesh(): BufferGeometry {
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);
        return geometry;
    }
}
```

## 추가 파일

### `ProjectileEntity.ts`
- 투사체 물리 시뮬레이션
- 블록/엔티티 충돌 감지
- 포물선 궤적 계산
- 수명 관리

## 데이터 구조

### ProjectileEntity 속성
```
interface ProjectileEntityData {
    position: Vector3;
    velocity: Vector3;
    ownerId: number;
    itemType: number;  // Snowball=264
    lifetime: number;
    damage: number;
}
```

### BlockCollision 인터페이스
```
interface BlockCollision {
    blockId: number;
    position: Vector3;
    normal: Vector3;
}
```

### 투사체 설정
```
const PROJECTILE_CONFIG = {
    gravity: -15,        // m/s²
    initialSpeed: 20,    // m/s
    lifetime: 5.0,       // seconds
    damage: 1.0,         // default damage
    zombieDamage: 0.5,   // zombie damage
    size: 0.3,           // sphere radius
};
```

## 핵심 로직

### 눈덩이 투척 로직
```
function throwSnowball(player: Player): void {
    // 인벤토리에서 눈덩이 확인
    const inventory = player.getInventory();
    const selectedSlot = inventory.getSelectedSlot();

    if (!selectedSlot || selectedSlot.itemId !== 264) {
        return;
    }

    // 눈덩이 소비
    selectedSlot.count -= 1;
    if (selectedSlot.count === 0) {
        inventory.setSelectedSlot(null);
    }

    // 카메라 방향 계산
    const camera = player.getCamera();
    const direction = camera.getWorldDirection(new Vector3());

    // 발사 위치 (눈높이)
    const spawnPosition = player.position.clone();
    spawnPosition.y += 1.6;

    // 초기 속도 (방향 * 20m/s + 약간 위쪽)
    const velocity = direction.clone().multiplyScalar(INITIAL_VELOCITY);
    velocity.y += 2.0;

    // 투사체 생성
    const projectile = new ProjectileEntity(
        spawnPosition,
        velocity,
        player.id,
        264  // Snowball
    );

    EntityManager.addEntity(projectile);

    // 사운드 재생
    AudioManager.play('snowball-throw');
}
```

### 투사체 물리 업데이트
```
function updateProjectile(projectile: ProjectileEntity, deltaTime: number): void {
    // 수평 속도 유지
    const horizontalSpeed = Math.sqrt(
        projectile.velocity.x * projectile.velocity.x +
        projectile.velocity.z * projectile.velocity.z
    );

    // 수직 속도에 중력 적용
    projectile.velocity.y += PROJECTILE_GRAVITY * deltaTime;

    // 포물선 궤적: x, z는 일정, y는 중력 영향
    projectile.position.x += projectile.velocity.x * deltaTime;
    projectile.position.y += projectile.velocity.y * deltaTime;
    projectile.position.z += projectile.velocity.z * deltaTime;

    // 수명 감소
    projectile.lifetime -= deltaTime;

    // 수명 종료 시 소멸
    if (projectile.lifetime <= 0) {
        EntityManager.removeEntity(projectile);
        return;
    }

    // 충돌 감지
    projectile.checkCollisions();
}
```

### 블록 충돌 처리
```
function handleBlockCollision(projectile: ProjectileEntity, collision: BlockCollision): void {
    // 파티클 효과 (눈덩이 파편)
    ParticleSystem.spawnImpactParticles(
        collision.position,
        'snow',
        5  // 5개 파티클
    );

    // 사운드 재생
    AudioManager.play('snowball-hit');

    // 투사체 소멸
    EntityManager.removeEntity(projectile);
}
```

### 엔티티 충돌 및 데미지
```
function handleEntityCollision(projectile: ProjectileEntity, entity: Entity): void {
    // 데미지 계산
    let actualDamage = projectile.damage;

    // 좀비는 절반 데미지
    if (entity.type === 'Zombie') {
        actualDamage = 0.5;
    }

    // 엔티티에 데미지 적용
    entity.takeDamage(actualDamage);

    // 파티클 효과
    ParticleSystem.spawnImpactParticles(
        projectile.position,
        'snow',
        3
    );

    // 사운드 재생
    AudioManager.play('snowball-hit');

    // 투사체 소멸
    EntityManager.removeEntity(projectile);

    // 데미지 표시 UI
    DamageIndicator.show(entity.position, actualDamage);
}
```

### Snow 블록 파괴 및 드롭
```
function breakSnowBlock(x: number, y: number, z: number): void {
    const blockId = World.getBlock(x, y, z);

    if (blockId !== BlockId.Snow) {
        return;
    }

    // 랜덤 드롭 수 (1-4개)
    const dropCount = Math.floor(Math.random() * 4) + 1;

    // Snowball 아이템 추가
    Inventory.addItem(264, dropCount);

    // 블록 제거
    World.setBlock(x, y, z, BlockId.Air);

    // 파티클 효과
    ParticleSystem.spawnSnowParticles(x, y, z, 10);

    // 사운드
    AudioManager.play('block-break-snow');

    // 청크 재생성
    MeshBuilder.markChunkDirty(getChunkPosition(x, y, z));
}
```

## 충돌/의존성

### 의존성
- `Items.ts`: Snowball 아이템 정의
- `World.ts`: 블록 파괴 시 Snowball 드롭
- `ProjectileEntity.ts`: 투사체 클래스
- `EntityManager.ts`: 투사체 등록/관리
- `Controls.ts`: 우클릭으로 투척
- `Physics.ts`: 투사체 중력 적용 (분리하여 ProjectileEntity에서 직접 관리)
- `AudioManager.ts`: 던지기/충돌 사운드
- `ParticleSystem.ts`: 파티클 효과
- `MeshBuilder.ts`: 투사체 메시

### 잠재적 충돌

1. **투사체 수명 관리**
   - 문제: 5초 후 자동 소멸 시 충돌 감지 누락 가능
   - 해결: 수명 종료 직전 마지막 충돌 체크

2. **다수 투사체 충돌 순서**
   - 문제: 여러 투사체가 동시에 같은 엔티티 충돌 시 데미지 중복 계산 가능
   - 해결: 투사체 ID로 충돌 디바운스 (0.1초 동일 엔티티에 최대 1회)

3. **낙하 데미지와 투사체 충돌**
   - 문제: 투사체가 낙하하는 플레이어에 맞으면 데미지 적용
   - 해결: 소유자 플레이어 제외 로직 강화

4. **멀티플레이어 동기화**
   - 문제: 투사체 위치/충돌이 다른 클라이언트와 동기화 필요
   - 해결: NetworkSync에 투사체 상태 전송

5. **투사체 AABB 크기**
   - 문제: 0.3 크기가 너무 작아 블록 충돌 감지 실패 가능
   - 해결: 서브스텝(substep)으로 충돌 감지 빈도 높이기

6. **Snowball 스태킹**
   - 문제: 16개 스태킹 시 UI 표시 문제
   - 해결: ItemStack UI에 count 레이블 추가

## 테스트 방법

### 1. 기능 테스트

```
테스트 1: Snow 블록 파괴 시 Snowball 드롭
- Snow 블록 10개 부수기
- 결과: 10-40개 Snowball 획득 (1-4개 랜덤)

테스트 2: 눈덩이 투척
- 눈덩이 아이템 선택 후 우클릭
- 결과: 투사체 생성, 휘파람 소리 재생

테스트 3: 투사체 포물선 궤적
- 수평으로 눈덩이 던지기
- 결과: 포물선 궤적 확인 (Y축 중력 적용)

테스트 4: 블록 충돌
- 10m 거리 벽에 눈덩이 던지기
- 결과: 충돌 시 파티클, 사운드, 투사체 소멸

테스트 5: 엔티티 충돌
- 좀비에게 눈덩이 던지기
- 결과: 좀비 체력 0.5 감소, 파티클, 사운드
```

### 2. 물리 테스트

```
테스트 6: 최대 사거리 측정
- 수평으로 눈덩이 던지고 도달 거리 측정
- 예상: v² = 2gh → 400 = 2*15*h → h ≈ 13.3m
- 결과: 약 13m 도달

테스트 7: 상단 발사 궤적
- 45도 각도로 눈덩이 던지기
- 결과: 더 높은 궤적, 최대 거리 증가

테스트 8: 수명 종료
- 공중으로 눈덩이 던지고 5초 대기
- 결과: 자동 소멸

테스트 9: 연속 투척
- 빠르게 10회 눈덩이 던지기
- 결과: 모든 투사체 정상 동작
```

### 3. 데미지 테스트

```
테스트 10: 일반 엔티티 데미지
- 플레이어에게 눈덩이 던지기
- 결과: 1 데미지 적용

테스트 11: 좀비 데미지
- 좀비에게 눈덩이 던지기
- 결과: 0.5 데미지 적용

테스트 12: 다수 투사체 동시 충돌
- 엔티티에 3개 눈덩이 동시에 던지기
- 결과: 3 데미지 적용 (데미지 중복 가능)
```

### 4. 경계 테스트

```
테스트 13: 극단적 거리 발사
- 100m 거리에 눈덩이 던지기
- 결과: 5초 수명 종료로 소멸

테스트 14: 블록 투과 시도
- 잎사귀(Leaves) 블록에 눈덩이 던지기
- 결과: 충돌 감지, 소멸 (solid=false도 충돌)

테스트 15: 수면(Water) 충돌
- 물에 눈덩이 던지기
- 결과: 충돌 없음, 물을 통과 (Water는 충돌 무시)
```

### 5. 스태킹 테스트

```
테스트 16: 최대 스태킹
- 16개 Snowball 획득
- 결과: 1슬롯에 16개 표시

테스트 17: 스태킹 초과
- 17번째 Snowball 획득 시도
- 결과: 새 슬롯에 1개 생성

테스트 18: 스태킹 분리
- 16개 Snowball에서 5개 꺼내기
- 결과: 11개 + 5개 분리
```

### 6. 사운드 테스트

```
테스트 19: 던지기 사운드
- 눈덩이 던지기
- 결과: 짧은 휘파람 소리 재생

테스트 20: 충돌 사운드
- 벽에 눈덩이 던지기
- 결과: 파지직 소리 재생

테스트 21: 연속 투척 사운드
- 10회 연속 던지기
- 결과: 매번 사운드 재생
```

### 7. 성능 테스트

```
테스트 22: 다수 투사체 동시 존재
- 100개 눈덩이 동시 발사
- FPS 모니터링
- 결과: 성능 저하 최소화

테스트 23: 충돌 감지 성능
- 50개 투사체가 100개 블록 근처 통과
- FPS 모니터링
- 결과: 충돌 감지 최적화 필요 여부 확인
```
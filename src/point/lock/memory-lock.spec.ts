import { Test, TestingModule } from '@nestjs/testing';
import { MemoryPointLock } from './memory-lock';

/**
 * MemoryPointLock 컴포넌트에 대한 단위 테스트
 * - 락 획득 및 해제 기능 검증
 * - 동시성 락 처리 검증
 * - 다중 락 처리 검증
 */
describe('메모리 기반 락 메커니즘 테스트', () => {
  let lock: MemoryPointLock;

  // 각 테스트 전에 새로운 락 인스턴스 생성
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryPointLock],
    }).compile();

    lock = module.get<MemoryPointLock>(MemoryPointLock);
  });

  /**
   * 테스트: 기본적인 락 획득 및 해제 기능 검증
   * 
   * 시나리오:
   * 1. 특정 사용자 ID에 대한 락을 획득
   * 2. 락 획득 확인
   * 3. 락 해제 실행
   * 4. 락이 정상적으로 해제되었는지 확인
   * 5. 다시 락을 획득할 수 있는지 확인
   */
  it('락을 정상적으로 획득하고 해제할 수 있어야 한다', async () => {
    const userId = 1;

    // 1. 락 획득
    const release = await lock.acquire(userId);

    // 2. 획득한 락이 함수인지 확인
    expect(release).toBeDefined();
    expect(typeof release).toBe('function');

    // 3. 내부 상태 확인 (락이 존재하는지)
    expect((lock as any).locks.has(userId)).toBe(true);

    // 4. 락 해제
    release();

    // 5. 락 해제를 위한 충분한 시간 대기 (프로미스 해결 시간)
    await new Promise(resolve => setTimeout(resolve, 10));

    // 6. 다시 락을 획득할 수 있는지 확인
    const release2 = await lock.acquire(userId);
    expect(release2).toBeDefined();

    // 7. 정리
    release2();
  });

  /**
   * 테스트: 동일 사용자에 대한 순차적 락 획득 검증
   * 
   * 시나리오:
   * 1. 첫 번째 락을 획득
   * 2. 두 번째 락 요청 (아직 획득되지 않음)
   * 3. 일정 시간 후에도 두 번째 락이 획득되지 않았는지 확인
   * 4. 첫 번째 락 해제
   * 5. 두 번째 락이 획득되었는지 확인
   */
  it('동일 사용자에 대한 락 요청은 이전 락이 해제된 후 순차적으로 처리되어야 한다', async () => {
    const userId = 1;

    // 1. 첫 번째 락 획득
    const release1 = await lock.acquire(userId);

    // 2. 두 번째 락 요청 (아직 획득되지 않음)
    let lock2Acquired = false;
    const lockPromise2 = lock.acquire(userId).then((release) => {
      lock2Acquired = true;
      return release;
    });

    // 3. 짧은 대기 후 두 번째 락이 아직 획득되지 않아야 함
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(lock2Acquired).toBe(false);

    // 4. 첫 번째 락 해제
    release1();

    // 5. 두 번째 락 획득 대기
    const release2 = await lockPromise2;

    // 6. 두 번째 락이 획득되었는지 확인
    expect(lock2Acquired).toBe(true);

    // 7. 정리
    release2();
  });

  /**
   * 테스트: 서로 다른 사용자에 대한 락의 독립성 검증
   * 
   * 시나리오:
   * 1. 두 명의 서로 다른 사용자에 대한 락 획득 요청
   * 2. 두 락 모두 동시에 획득 가능한지 확인
   * 3. 각각의 락 해제
   */
  it('서로 다른 사용자의 락은 서로 간섭하지 않고 독립적으로 동작해야 한다', async () => {
    const user1 = 1;
    const user2 = 2;

    // 1. 두 사용자에 대한 락 획득
    const release1 = await lock.acquire(user1);
    const release2 = await lock.acquire(user2);

    // 2. 두 락 모두 정상적으로 획득되었는지 확인
    expect(release1).toBeDefined();
    expect(release2).toBeDefined();

    // 3. 내부 상태 확인
    expect((lock as any).locks.has(user1)).toBe(true);
    expect((lock as any).locks.has(user2)).toBe(true);

    // 4. 각각 락 해제
    release1();
    release2();
  });

  /**
   * 테스트: 여러 락의 순차적 처리 검증
   * 
   * 시나리오:
   * 1. 첫 번째 락 획득
   * 2. 여러 개의 추가 락 요청
   * 3. 순서대로 락을 해제하면서 다음 락이 획득되는지 확인
   */
  it('여러 락 요청이 대기 큐에 쌓여도 순서대로 정확하게 처리되어야 한다', async () => {
    const userId = 1;
    const numberOfLocks = 5;
    const lockReleases: Array<() => void> = [];

    // 1. 첫 번째 락 획득
    lockReleases.push(await lock.acquire(userId));

    // 2. 나머지 락 요청들 (아직 획득되지 않음)
    const lockPromises = Array(numberOfLocks - 1)
      .fill(null)
      .map(() => lock.acquire(userId));

    // 3. 순서대로 락을 해제하면서 다음 락이 획득되는지 확인
    for (let i = 0; i < numberOfLocks - 1; i++) {
      // 현재 락 해제
      lockReleases[i]();

      // 다음 락이 획득되기를 기다림
      const release = await lockPromises[i];
      lockReleases.push(release);

      // 해당 락이 제대로 획득되었는지 확인
      expect(release).toBeDefined();
    }

    // 4. 마지막 락 해제
    lockReleases[lockReleases.length - 1]();
  });
});
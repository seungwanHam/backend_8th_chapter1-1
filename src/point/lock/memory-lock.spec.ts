import { Test, TestingModule } from '@nestjs/testing';
import { MemoryPointLock } from './memory-lock';

describe('MemoryPointLock', () => {
  let lock: MemoryPointLock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryPointLock],
    }).compile();

    lock = module.get<MemoryPointLock>(MemoryPointLock);
  });

  it('락 획득 및 해제 기본 기능', async () => {
    const userId = 1;
    const release = await lock.acquire(userId);

    expect(typeof release).toBe('function');

    // 락 해제
    release();

    // 다시 락 획득 가능 확인
    const release2 = await lock.acquire(userId);
    expect(typeof release2).toBe('function');
    release2();
  });

  it('동일 사용자 락은 순차적으로 처리됨', async () => {
    const userId = 1;

    // 첫 번째 락 획득
    const release1 = await lock.acquire(userId);

    // 두 번째 락 요청
    let lock2Acquired = false;
    const lockPromise2 = lock.acquire(userId).then(release => {
      lock2Acquired = true;
      return release;
    });

    // 대기 후 두 번째 락이 아직 획득되지 않아야 함
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(lock2Acquired).toBe(false);

    // 첫 번째 락 해제 후 두 번째 락 획득 확인
    release1();
    const release2 = await lockPromise2;
    expect(lock2Acquired).toBe(true);
    release2();
  });

  it('서로 다른 사용자의 락은 독립적으로 동작', async () => {
    const user1 = 1;
    const user2 = 2;

    // 두 사용자의 락을 동시에 획득할 수 있어야 함
    const release1 = await lock.acquire(user1);
    const release2 = await lock.acquire(user2);

    expect(typeof release1).toBe('function');
    expect(typeof release2).toBe('function');

    release1();
    release2();
  });

  it('여러 락 요청은 순서대로 처리됨', async () => {
    const userId = 1;
    const numberOfLocks = 5;
    const lockReleases: Array<() => void> = [];

    // 첫 번째 락 획득
    lockReleases.push(await lock.acquire(userId));

    // 나머지 락 요청
    const lockPromises = Array(numberOfLocks - 1)
      .fill(null)
      .map(() => lock.acquire(userId));

    // 순서대로 락 해제하며 다음 락 획득 확인
    for (let i = 0; i < numberOfLocks - 1; i++) {
      lockReleases[i]();
      const release = await lockPromises[i];
      lockReleases.push(release);
      expect(typeof release).toBe('function');
    }

    lockReleases[lockReleases.length - 1]();
  });
});
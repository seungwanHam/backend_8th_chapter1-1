import { Test, TestingModule } from '@nestjs/testing';
import { MemoryResourceLock } from './memory-lock';

describe('MemoryResourceLock', () => {
  let lock: MemoryResourceLock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryResourceLock],
    }).compile();

    lock = module.get<MemoryResourceLock>(MemoryResourceLock);
  });

  it('락 획득 및 해제 기본 기능', async () => {
    const resourceId = 1;
    const release = await lock.acquire(resourceId);

    expect(typeof release).toBe('function');

    // 락 해제
    release();

    // 다시 락 획득 가능 확인
    const release2 = await lock.acquire(resourceId);
    expect(typeof release2).toBe('function');
    release2();
  });

  it('동일 리소스 락은 순차적으로 처리됨', async () => {
    const resourceId = 1;

    // 첫 번째 락 획득
    const release1 = await lock.acquire(resourceId);

    // 두 번째 락 요청
    let lock2Acquired = false;
    const lockPromise2 = lock.acquire(resourceId).then(release => {
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

  it('서로 다른 리소스의 락은 독립적으로 동작', async () => {
    const resource1 = 1;
    const resource2 = 2;

    // 두 리소스의 락을 동시에 획득할 수 있어야 함
    const release1 = await lock.acquire(resource1);
    const release2 = await lock.acquire(resource2);

    expect(typeof release1).toBe('function');
    expect(typeof release2).toBe('function');

    release1();
    release2();
  });

  it('여러 락 요청은 순서대로 처리됨', async () => {
    const resourceId = 1;
    const numberOfLocks = 5;
    const lockReleases: Array<() => void> = [];

    // 첫 번째 락 획득
    lockReleases.push(await lock.acquire(resourceId));

    // 나머지 락 요청
    const lockPromises = Array(numberOfLocks - 1)
      .fill(null)
      .map(() => lock.acquire(resourceId));

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
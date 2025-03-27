import { Injectable } from '@nestjs/common';
import { IPointLock } from './point-lock.interface';
import { Mutex } from 'async-mutex';

@Injectable()
export class MemoryPointLock implements IPointLock {
  // 사용자별 Mutex 관리
  private mutexes: Map<number, Mutex> = new Map();

  /**
   * 특정 사용자 ID에 대한 락을 획득
   * @param userId 락을 획득할 사용자 ID
   * @returns 락 해제 함수
   */
  async acquire(userId: number): Promise<() => void> {
    // 해당 사용자의 Mutex가 없으면 생성
    if (!this.mutexes.has(userId)) {
      this.mutexes.set(userId, new Mutex());
    }

    // Mutex 획득
    const mutex = this.mutexes.get(userId)!;
    const release = await mutex.acquire();

    return release;
  }
}
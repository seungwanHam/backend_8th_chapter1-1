import { Injectable } from '@nestjs/common';
import { IResourceLock } from './lock.interface';
import { Mutex } from 'async-mutex';

@Injectable()
export class MemoryResourceLock implements IResourceLock {
  // 리소스별 Mutex 관리
  private mutexes: Map<number, Mutex> = new Map();

  /**
   * 특정 리소스 ID에 대한 락을 획득
   * @param resourceId 락을 획득할 리소스 ID
   * @returns 락 해제 함수
   */
  async acquire(resourceId: number): Promise<() => void> {
    // 해당 리소스의 Mutex가 없으면 생성
    if (!this.mutexes.has(resourceId)) {
      this.mutexes.set(resourceId, new Mutex());
    }

    // Mutex 획득
    const mutex = this.mutexes.get(resourceId)!;
    const release = await mutex.acquire();

    return release;
  }
}
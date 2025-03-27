import { Injectable } from '@nestjs/common';
import { IPointLock } from './point-lock.interface';

@Injectable()
export class MemoryPointLock implements IPointLock {
  // 사용자 ID별 락 관리
  private locks: Map<number, Promise<void>> = new Map();

  /**
   * 특정 사용자 ID에 대한 락을 획득
   * 이미 다른 요청이 락을 보유하고 있다면 해제될 때까지 대기
   * 
   * @param userId 락을 획득할 사용자 ID
   * @returns 락 해제 함수
   */
  async acquire(userId: number): Promise<() => void> {
    let release: () => void;

    // 새로운 락 생성
    const newLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    // 해당 사용자에 대한 기존 락이 있으면 해제될 때까지 대기
    const existingLock = this.locks.get(userId);
    if (existingLock) {
      await existingLock;
    }

    // 새 락 설정
    this.locks.set(userId, newLock);

    // 락 해제 함수 반환
    return release!;
  }
}
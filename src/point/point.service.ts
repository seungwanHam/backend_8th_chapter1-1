import { Inject, Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';
import { InsufficientPointException, InvalidAmountException, InvalidUserIdException, MaxPointExceededException } from './point.exception';
import { IPointLock } from './lock/point-lock.interface';

@Injectable()
export class PointService {
  // 최대 포인트 값 설정 (추후 변경 가능성으로인해 상수로 선언) - TODO :: config로 분리 ?
  private readonly MAX_POINT = 1000000;

  constructor(
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
    @Inject('POINT_LOCK') private readonly pointLock: IPointLock,
  ) { }

  /**
   * 사용자의 포인트 잔액을 조회합니다.
   * 
   * @param userId - 조회할 사용자의 ID
   * @returns 사용자의 포인트 정보
   * @throws {InvalidUserIdException} 유효하지 않은 사용자 ID인 경우
   */
  async getPoint(userId: number): Promise<UserPoint> {
    if (userId <= 0) {
      throw new InvalidUserIdException(userId);
    }
    return this.userPointTable.selectById(userId);
  }

  /**
   * 사용자의 포인트 충전/사용 내역을 조회합니다.
   * 
   * @param userId - 조회할 사용자의 ID
   * @returns 포인트 내역 목록
   * @throws {InvalidUserIdException} 유효하지 않은 사용자 ID인 경우
   */
  async getPointHistories(userId: number): Promise<PointHistory[]> {
    if (userId <= 0) {
      throw new InvalidUserIdException(userId);
    }
    return this.pointHistoryTable.selectAllByUserId(userId);
  }

  /**
   * 사용자의 포인트를 충전합니다.
   * 충전 금액은 1 이상의 양수여야 하며, 최대 포인트 한도를 초과할 수 없습니다.
   * 동시성 제어를 위해 사용자별 락을 획득한 후 처리합니다.
   * 
   * @param userId - 포인트를 충전할 사용자의 ID
   * @param amount - 충전할 포인트 양
   * @returns 갱신된 사용자 포인트 정보
   * @throws {InvalidAmountException} 충전 금액이 0 이하인 경우
   * @throws {MaxPointExceededException} 충전 후 포인트가 최대 한도를 초과하는 경우
   */
  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    if (amount <= 0) {
      throw new InvalidAmountException(amount);
    }

    // 락 획득
    const releaseLock = await this.pointLock.acquire(userId);

    try {
      // 현재 포인트 조회
      const userPoint = await this.userPointTable.selectById(userId);

      // 최대 포인트 한도 검사
      if (userPoint.point + amount > this.MAX_POINT) {
        throw new MaxPointExceededException(userPoint.point, amount, this.MAX_POINT);
      }

      // 포인트 증가
      const newPoint = userPoint.point + amount;
      const updatedUserPoint = await this.userPointTable.insertOrUpdate(userId, newPoint);

      // 포인트 내역 기록
      const now = Date.now();
      await this.pointHistoryTable.insert(
        userId,
        amount,
        TransactionType.CHARGE,
        now
      );

      return updatedUserPoint;
    } finally {
      // 락 해제 (에러가 발생하더라도 반드시 락은 해제)
      releaseLock();
    }
  }

  /**
   * 사용자의 포인트를 사용합니다.
   * 사용 금액은 1 이상의 양수여야 하며, 현재 보유 포인트를 초과할 수 없습니다.
   * 동시성 제어를 위해 사용자별 락을 획득한 후 처리합니다.
   * 
   * @param userId - 포인트를 사용할 사용자의 ID
   * @param amount - 사용할 포인트 양
   * @returns 갱신된 사용자 포인트 정보
   * @throws {InvalidAmountException} 사용 금액이 0 이하의 음수인 경우
   * @throws {InsufficientPointException} 현재 보유 포인트보다 많은 금액을 사용하려는 경우
   */
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    if (amount <= 0) {
      throw new InvalidAmountException(amount);
    }

    // 락 획득
    const releaseLock = await this.pointLock.acquire(userId);

    try {
      // 현재 포인트 조회
      const userPoint = await this.userPointTable.selectById(userId);

      // 포인트 차감 가능 여부 검사
      if (userPoint.point < amount) {
        throw new InsufficientPointException(userPoint.point, amount);
      }

      // 포인트 차감
      const newPoint = userPoint.point - amount;
      const updatedUserPoint = await this.userPointTable.insertOrUpdate(userId, newPoint);

      // 포인트 내역 기록
      const now = Date.now();
      await this.pointHistoryTable.insert(userId, amount, TransactionType.USE, now);

      return updatedUserPoint;
    } finally {
      // 락 해제 (에러가 발생하더라도 반드시 락은 해제)
      releaseLock();
    }
  }
}
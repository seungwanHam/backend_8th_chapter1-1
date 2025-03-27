import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';
import { InsufficientPointException, InvalidAmountException, InvalidUserIdException, MaxPointExceededException } from './point.exception';


@Injectable()
export class PointService {
  // 최대 포인트 값 설정 (추후 변경 가능성으로인해 상수로 선언) - TODO :: config로 분리 ?
  private readonly MAX_POINT = 1000000;

  constructor(
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
  ) { }

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

    const userPoint = await this.userPointTable.selectById(userId);

    if (userPoint.point + amount > this.MAX_POINT) {
      throw new MaxPointExceededException(userPoint.point, amount, this.MAX_POINT);
    }

    const newPoint = userPoint.point + amount;
    const updatedUserPoint = await this.userPointTable.insertOrUpdate(userId, newPoint);

    const now = Date.now();
    await this.pointHistoryTable.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      now
    );

    return updatedUserPoint;
  }
}
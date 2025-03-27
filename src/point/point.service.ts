import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';
import { InvalidUserIdException } from './point.exception';


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
   * @throws {Error} 유효하지 않은 사용자 ID인 경우
   */
  async getPointHistories(userId: number): Promise<PointHistory[]> {
    if (userId <= 0) {
      throw new InvalidUserIdException(userId);
    }
    return this.pointHistoryTable.selectAllByUserId(userId);
  }
}
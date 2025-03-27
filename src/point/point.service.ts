import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';


@Injectable()
export class PointService {
  // 최대 포인트 값 설정 (추후 변경 가능성으로인해 상수로 선언) - TODO :: config로 분리 ?
  private readonly MAX_POINT = 1000000;

  constructor(
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
  ) { }

  async getPoint(userId: number): Promise<UserPoint> {
    return this.userPointTable.selectById(userId);
  }
}
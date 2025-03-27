import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { PointModule } from './point.module';
import { MemoryResourceLock } from '../common/locks/memory-lock';

/**
 * 포인트 시스템 통합 테스트
 * - 컴포넌트 간 상호작용과 동시성 처리 검증
 */
describe('Point 통합 테스트', () => {
  let app: INestApplication;
  let service: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;
  let pointLock: MemoryResourceLock;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PointModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    service = moduleFixture.get<PointService>(PointService);
    userPointTable = moduleFixture.get<UserPointTable>(UserPointTable);
    pointHistoryTable = moduleFixture.get<PointHistoryTable>(PointHistoryTable);
    pointLock = moduleFixture.get<MemoryResourceLock>('POINT_LOCK');

    await app.init();
  });

  describe('동시성 제어 및 기능 테스트', () => {
    it('포인트 충전: 여러 요청이 순차적으로 처리되어야 한다', async () => {
      // Given
      const userId = 1;
      const initialPoint = 0;
      const chargeAmount = 100;

      await userPointTable.insertOrUpdate(userId, initialPoint);

      // When: 5번 순차 충전
      for (let i = 0; i < 5; i++) {
        await service.chargePoint(userId, chargeAmount);
      }

      // Then
      const result = await service.getPoint(userId);
      expect(result.point).toBe(initialPoint + (chargeAmount * 5));
    });

    it('포인트 사용: 잔액 이상 사용할 수 없어야 한다', async () => {
      // Given
      const userId = 1;
      const initialPoint = 500;
      const useAmount = 200;

      await userPointTable.insertOrUpdate(userId, initialPoint);

      // When: 3번 연속 차감 시도
      let successCount = 0;
      for (let i = 0; i < 3; i++) {
        try {
          await service.usePoint(userId, useAmount);
          successCount++;
        } catch (error) {
          // 예외 발생 시 무시 (잔액 부족 예상)
        }
      }

      // Then
      const finalBalance = await service.getPoint(userId);
      expect(successCount).toBeLessThanOrEqual(2); // 최대 2번만 성공
      expect(finalBalance.point).toBe(initialPoint - (useAmount * successCount));
    });

    it('혼합 요청: 충전과 사용이 번갈아 처리되어도 잔액이 정확해야 한다', async () => {
      // Given
      const userId = 1;
      const initialPoint = 300;
      const chargeAmount = 100;
      const useAmount = 150;

      await userPointTable.insertOrUpdate(userId, initialPoint);

      // When: 충전/차감 번갈아 실행
      const operations = [
        () => service.chargePoint(userId, chargeAmount),  // +100
        () => service.usePoint(userId, useAmount),        // -150
        () => service.chargePoint(userId, chargeAmount),  // +100
        () => service.usePoint(userId, useAmount)         // -150
      ];

      let expectedBalance = initialPoint;

      for (const operation of operations) {
        try {
          await operation();
          if (operation.toString().includes('chargePoint')) {
            expectedBalance += chargeAmount;
          } else {
            expectedBalance -= useAmount;
          }
        } catch (error) {
          // 실패 시 잔액 변동 없음
        }
      }

      // Then
      const finalBalance = await service.getPoint(userId);
      expect(finalBalance.point).toBe(expectedBalance);
    });

    it('동시 충전: 여러 충전 요청이 모두 반영되어야 한다', async () => {
      // Given
      const userId = 1;
      const initialPoint = 1000;
      const chargeAmount1 = 100;
      const chargeAmount2 = 200;

      await userPointTable.insertOrUpdate(userId, initialPoint);

      // When: 동시 충전 요청
      await Promise.all([
        service.chargePoint(userId, chargeAmount1),
        service.chargePoint(userId, chargeAmount2)
      ]);

      // Then
      const finalPoint = await service.getPoint(userId);
      expect(finalPoint.point).toBe(initialPoint + chargeAmount1 + chargeAmount2);

      // 이력 확인
      const histories = await service.getPointHistories(userId);
      const charges = histories.filter(h => h.type === 0);
      expect(charges.length).toBe(2);

      const amounts = charges.map(h => h.amount);
      expect(amounts).toContain(chargeAmount1);
      expect(amounts).toContain(chargeAmount2);
    });

    it('동시 차감: 잔액 이상의 요청은 일부만 성공해야 한다', async () => {
      // Given
      const userId = 1;
      const initialPoint = 500;
      const useAmount = 200;

      await userPointTable.insertOrUpdate(userId, initialPoint);

      // When: 동시 차감 요청 (총 800 요청, 잔액 500)
      const results = await Promise.allSettled([
        service.usePoint(userId, useAmount),
        service.usePoint(userId, useAmount),
        service.usePoint(userId, useAmount),
        service.usePoint(userId, useAmount)
      ]);

      // Then
      const finalPoint = await service.getPoint(userId);

      // 잔액은 항상 0 이상이어야 함
      expect(finalPoint.point).toBeGreaterThanOrEqual(0);

      // 성공한 요청 수 확인
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeLessThanOrEqual(Math.floor(initialPoint / useAmount));

      // 이력 확인
      const histories = await service.getPointHistories(userId);
      const useHistories = histories.filter(h => h.type === 1);
      expect(useHistories.length).toBe(successCount);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
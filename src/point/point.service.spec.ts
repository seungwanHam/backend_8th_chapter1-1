import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { InvalidUserIdException, InvalidAmountException, MaxPointExceededException, InsufficientPointException } from './point.exception';
import { TransactionType } from './point.model';

// describe :: 관련된 테스트 케이스들을 논리적으로 그룹화, 중첩이 가능하여 계층적 테스트 구조를 만들 수 있다.
describe('PointService', () => {
  let service: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  // beforeEach :: 각 테스트 케이스 실행 전에 실행되는 코드
  beforeEach(async () => {
    // Test.createTestingModule :: NestJS 모듈을 테스트용으로 생성하는 메서드. 의존성 주입을 테스트 하는 환경에서도 활용할 수 있도록 해줌.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        UserPointTable,
        PointHistoryTable,
      ]
    }).compile();

    // module.get<T>: 특정 타입의 의존성을 모듈에서 가져오는 메서드
    service = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  // it :: 실제 테스트 케이스를 정의. 각 it 블록은 하나의 테스트 케이스를 나타낸다.
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPoint', () => {
    it('사용자 ID로 포인틀르 조회할 수 있어야 한다.', async () => {
      // Given
      const userId = 1;
      const expectedPoint = { id: userId, point: 100, updateMillis: Date.now() };
      // jest.spyOn :: 특정 객체의 메서드를 모니터링하고 제어할 수 있는 스파이를 생성.
      // mockResolvedValue :: 비동기 함수가 특정 값으로 해결되도록 모킹.
      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(expectedPoint);

      // When
      const result = await service.getPoint(userId);

      // Then
      // expect :: 특정 값을 검증
      // toEqual :: 값이 예상한 객체와 동일한지 검증
      expect(result).toEqual(expectedPoint);
      // toHaveBeenCalledWith :: 특정 함수가 특정 인자로 호출되었는지 검증
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
    })

    it('유효하지 않은 사용자 ID로 포인트 조회 시 예외가 발생해야 한다.', async () => {
      // Given
      const invalidUserId = -1;

      // 1. 서비스 계층에서 ID 유효성을 검증하도록 수정
      // 2. 직접적으로 InvalidUserIdException을 사용해야 함

      // When & Then
      await expect(service.getPoint(invalidUserId))
        .rejects
        .toThrow(InvalidUserIdException);

      // 원한다면 더 구체적인 메시지 검증도 가능 
      await expect(service.getPoint(invalidUserId))
        .rejects
        .toHaveProperty('message', `유효하지 않은 사용자 ID입니다: ${invalidUserId}`);
    })
  })

  describe('getPointHistories', () => {
    it('사용자 ID로 포인트 내역을 모두 조회할 수 있어야 한다.', async () => {
      // Given
      const userId = 1;
      const expectedHistories = [
        { id: 1, userId, amount: 100, type: TransactionType.CHARGE, timeMillis: Date.now() },
        { id: 2, userId, amount: 50, type: TransactionType.USE, timeMillis: Date.now() },
      ];
      jest.spyOn(pointHistoryTable, 'selectAllByUserId').mockResolvedValue(expectedHistories);

      // When
      const result = await service.getPointHistories(userId);

      // Then
      expect(result).toEqual(expectedHistories);
      expect(pointHistoryTable.selectAllByUserId).toHaveBeenCalledWith(userId);
    })

    it('유효하지 않은 사용자 ID로 내역 조회 시 예외가 발생해야 한다', async () => {
      // Given
      const invalidUserId = -1;
      jest.spyOn(pointHistoryTable, 'selectAllByUserId').mockImplementation(() => {
        throw new InvalidUserIdException(invalidUserId);
      });

      // When & Then
      await expect(service.getPointHistories(invalidUserId))
        .rejects
        .toThrow(InvalidUserIdException);
    });

    it('사용한 포인트 내역이 없는 경우 빈 배열을 반환해야 한다.', async () => {
      // Given
      const userId = 1;
      const expectedHistories = [];
      jest.spyOn(pointHistoryTable, 'selectAllByUserId').mockResolvedValue(expectedHistories);

      // When
      const result = await service.getPointHistories(userId);

      // Then
      expect(result).toEqual(expectedHistories);
      expect(pointHistoryTable.selectAllByUserId).toHaveBeenCalledWith(userId);
    })
  })

  describe('chargePoint', () => {
    it('1 이상의 양수인 유효한 금액으로 포인트를 충전할 수 있어야 한다', async () => {
      // Given
      const userId = 1;
      const amount = 100;
      const currentPoint = { id: userId, point: 200, updateMillis: Date.now() };
      const updatedPoint = { id: userId, point: 300, updateMillis: Date.now() };
      const history = { id: 1, userId, amount, type: TransactionType.CHARGE, timeMillis: expect.any(Number) };

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);
      jest.spyOn(userPointTable, 'insertOrUpdate').mockResolvedValue(updatedPoint);
      jest.spyOn(pointHistoryTable, 'insert').mockResolvedValue(history);

      // When
      const result = await service.chargePoint(userId, amount);

      // Then
      expect(result).toEqual(updatedPoint);
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledWith(userId, 300);
      expect(pointHistoryTable.insert).toHaveBeenCalledWith(userId, amount, TransactionType.CHARGE, expect.any(Number));
    })

    it('음수 금액으로 충전할 경우 예외가 발생해야 한다', async () => {
      // Given
      const userId = 1;
      const negativeAmount = -100;

      // When & Then
      await expect(service.chargePoint(userId, negativeAmount))
        .rejects
        .toThrow(InvalidAmountException);
    });

    it('최대 포인트를 초과할 경우 예외가 발생해야 한다', async () => {
      // Given
      const userId = 1;
      const currentPoint = { id: userId, point: 900000, updateMillis: Date.now() };
      const largeAmount = 200000; // 합계가 MAX_POINT(1000000)를 초과

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);

      // When & Then
      await expect(service.chargePoint(userId, largeAmount))
        .rejects
        .toThrow(MaxPointExceededException);
    });
  })

  describe('usePoint', () => {
    it('유효한 금액으로 포인트를 사용할 수 있어야 한다', async () => {
      // Given
      const userId = 1;
      const amount = 50;
      const currentPoint = { id: userId, point: 200, updateMillis: Date.now() };
      const updatedPoint = { id: userId, point: 150, updateMillis: Date.now() };
      const history = {
        id: 1,
        userId,
        amount,
        type: TransactionType.USE,
        timeMillis: expect.any(Number)
      };

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);
      jest.spyOn(userPointTable, 'insertOrUpdate').mockResolvedValue(updatedPoint);
      jest.spyOn(pointHistoryTable, 'insert').mockResolvedValue(history);

      // When
      const result = await service.usePoint(userId, amount);

      // Then
      expect(result).toEqual(updatedPoint);
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledWith(userId, 150);
      expect(pointHistoryTable.insert).toHaveBeenCalledWith(
        userId,
        amount,
        TransactionType.USE,
        expect.any(Number)
      );
    });

    it('음수 금액으로 사용할 경우 예외가 발생해야 한다', async () => {
      // Given
      const userId = 1;
      const negativeAmount = -50;

      // When & Then
      await expect(service.usePoint(userId, negativeAmount))
        .rejects
        .toThrow(InvalidAmountException);
    });

    it('잔고가 부족할 경우 예외가 발생해야 한다', async () => {
      // Given
      const userId = 1;
      const currentPoint = { id: userId, point: 100, updateMillis: Date.now() };
      const largeAmount = 200; // 현재 포인트보다 큰 금액

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);

      // When & Then
      await expect(service.usePoint(userId, largeAmount))
        .rejects
        .toThrow(InsufficientPointException);
    });
  });

})
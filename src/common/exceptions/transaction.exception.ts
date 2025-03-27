import { HttpException, HttpStatus } from "@nestjs/common";

//#region 입력 검증 커버
export class InvalidUserIdException extends HttpException {
  constructor(userId: number) {
    super(
      `유효하지 않은 사용자 ID입니다: ${userId}`,
      HttpStatus.BAD_REQUEST
    );
  }
}

export class InvalidAmountException extends HttpException {
  constructor(amount: number) {
    super(
      `유효하지 않은 금액입니다: ${amount}. 금액은 1 이상이어야 합니다.`,
      HttpStatus.BAD_REQUEST
    );
  }
}
//#endregion

//#region 비즈니스 요구사항 커버
export class InsufficientPointException extends HttpException {
  constructor(currentPoint: number, requestAmount: number) {
    super(
      `잔여 포인트가 부족합니다. 현재 보유 포인트: ${currentPoint}, 사용 요청량: ${requestAmount}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class MaxPointExceededException extends HttpException {
  constructor(currentPoint: number, additionalAmount: number, maxPoint: number) {
    super(
      `최대 포인트를 초과합니다. 현재 포인트: ${currentPoint}, 추가 금액: ${additionalAmount}, 최대 포인트: ${maxPoint}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
//#endregion

//#region 시스템 오류 대응
export class PointTransactionFailedException extends HttpException {
  constructor(message: string) {
    super(
      `포인트 트랜잭션 처리 중 오류가 발생했습니다: ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
//#endregion
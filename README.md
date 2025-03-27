# 동시성 제어 전략: TypeScript/Node.js 환경에서의 구현과 분석

## 목차
- [동시성 제어 전략: TypeScript/Node.js 환경에서의 구현과 분석](#동시성-제어-전략-typescriptnodejs-환경에서의-구현과-분석)
  - [목차](#목차)
  - [1. 소개](#1-소개)
  - [2. Node.js 동시성 모델 분석](#2-nodejs-동시성-모델-분석)
  - [3. 포인트 서비스의 동시성 요구사항](#3-포인트-서비스의-동시성-요구사항)
  - [4. 구현 전략: async-mutex](#4-구현-전략-async-mutex)
    - [핵심 구현](#핵심-구현)
    - [서비스 레이어 적용 예시](#서비스-레이어-적용-예시)
    - [장점](#장점)
    - [단점](#단점)
  - [5. 대안 접근법 비교](#5-대안-접근법-비교)
    - [Redis 기반 분산 락](#redis-기반-분산-락)
    - [Worker Threads](#worker-threads)
    - [데이터베이스 트랜잭션](#데이터베이스-트랜잭션)
  - [6. 성능 고려사항](#6-성능-고려사항)
  - [7. 결론 및 향후 방향](#7-결론-및-향후-방향)

## 1. 소개

포인트 서비스와 같은 금융 관련 시스템에서 동시성 제어는 데이터 무결성을 보장하는 핵심 요소입니다. 이 문서는 TypeScript와 NestJS를 활용한 환경에서 동시성 문제를 해결하기 위한 다양한 접근법을 분석하고, 실제 구현 과정에서의 결정 이유를 설명합니다.

## 2. Node.js 동시성 모델 분석

Node.js는 일반적인 멀티스레드 모델과는 다른, 이벤트 기반의 단일 스레드 아키텍처를 가지고 있으며, 이는 동시성 제어 전략을 설계할 때 중요한 고려 요소가 됩니다.

* **이벤트 기반 단일 스레드**: 하나의 메인 스레드에서 이벤트 루프를 통해 순차적으로 작업 처리
* **비차단(non-blocking) I/O**: 네트워크 요청, 파일 접근 등은 libuv 기반의 백그라운드 스레드 풀에서 비동기적으로 처리
* **비동기 프로그래밍 모델**: Promise, async/await, callback 등을 통해 비동기 흐름을 효율적으로 제어

```
┌────────────────────────┐
│ Event Loop             │
└─────────┬──────────────┘
          │
┌─────────▼──────────────┐    ┌──────────────────┐
│ Node.js 단일 스레드        ━━━▶  Worker Threads 
└─────────┬──────────────┘    └──────────────────┘
          │
┌─────────▼──────────────┐
│ 비동기 I/O Pool          
└────────────────────────┘
```

이러한 모델은 I/O 집약적 작업에서 높은 효율성을 보이지만, 메모리 내 데이터 경쟁 상태를 해결하기 위한 추가 메커니즘이 필요합니다.

## 3. 포인트 서비스의 동시성 요구사항

포인트 서비스에서는 다음과 같은 동시성 문제가 발생할 수 있습니다:

* **동시 포인트 사용**: 같은 사용자가 여러 요청을 동시에 보내 잔액보다 많은 포인트를 사용
* **동시 충전/사용**: 충전과 사용이 동시에 이루어질 때 데이터 일관성 보장
* **시스템 과부하**: 대량의 동시 요청 처리 시 성능 저하 방지

이러한 문제를 해결하기 위해 효과적인 동시성 제어 메커니즘이 필수적입니다.

## 4. 구현 전략: async-mutex

NestJS 애플리케이션에서는 `async-mutex` 라이브러리를 활용한 메모리 내 락 메커니즘을 구현했습니다.

### 핵심 구현

```typescript
@Injectable()
export class MemoryPointLock implements IPointLock {
  // 사용자별 뮤텍스 관리
  private mutexes: Map<number, Mutex> = new Map();

  // 락 획득 메서드
  async acquire(userId: number): Promise<() => void> {
    // 사용자별 뮤텍스 생성 (필요 시)
    if (!this.mutexes.has(userId)) {
      this.mutexes.set(userId, new Mutex());
    }

    // 뮤텍스 획득 및 해제 함수 반환
    const mutex = this.mutexes.get(userId)!;
    const release = await mutex.acquire();
    
    return release;
  }
}
```

### 서비스 레이어 적용 예시

```typescript
async usePoint(userId: number, amount: number): Promise<UserPoint> {
  // 락 획득
  const release = await this.pointLock.acquire(userId);
  
  try {
    // 잔액 검증 및 포인트 차감 로직
    const userPoint = await this.userPointTable.selectById(userId);
    if (userPoint.point < amount) {
      throw new InsufficientPointException();
    }
    
    // 비즈니스 로직 수행
    return await this.updateUserPoint(userId, userPoint.point - amount);
  } finally {
    // 항상 락 해제 보장
    release();
  }
}
```

### 장점

* **비동기 패턴 통합**: TypeScript의 async/await과 완벽하게 호환
* **코드 가독성**: 직관적인 API로 락 획득/해제 로직 명확화
* **사용자별 독립 락**: 서로 다른 사용자 간 성능 간섭 최소화
* **예외 안전성**: finally 블록을 통한 락 해제 보장

### 단점

* **단일 서버 제한**: 분산 환경에서 동작하지 않음
* **메모리 사용량**: 활성 사용자 증가에 따른 메모리 소비
* **프로세스 장애 취약성**: 서버 재시작 시 락 상태 초기화

## 5. 대안 접근법 비교

TypeScript/Node.js 환경에서 고려할 수 있는 주요 대안들과 비교 분석:

| 접근법                | 구현 복잡도 | 분산 환경 지원 | 성능      | 주요 사용 케이스                |
| --------------------- | ----------- | -------------- | --------- | ------------------------------- |
| **Mutex (In-Memory)** | 낮음        | ❌              | 높음      | 단일 서버, 사용자별 동시성 제어 |
| **Redis 기반 락**     | 중간        | ✅              | 중간      | 다중 서버, 클러스터 환경        |
| **Worker Threads**    | 높음        | ❌              | 높음      | CPU 집약적 작업, 병렬 처리      |
| **DB 트랜잭션**       | 낮음        | ✅              | 중간-낮음 | 데이터 일관성 중심 작업         |

### Redis 기반 분산 락

분산 환경에서 여러 서버 간 동기화를 제공합니다:

```typescript
// Redis 기반 락 구현 개념
class RedisPointLock implements IPointLock {
  async acquire(userId: number): Promise<() => void> {
    const key = `lock:user:${userId}`;
    // 타임아웃과 함께 락 획득 시도
    await this.redisClient.set(key, '1', 'PX', 10000, 'NX');
    return async () => await this.redisClient.del(key);
  }
}
```

### Worker Threads

CPU 집약적인 작업에 적합한 병렬 처리 방식:

```typescript
// Worker Thread 활용 개념
const worker = new Worker('./pointCalculator.js');
worker.postMessage({ userId, amount });
worker.on('message', result => {
  // 계산 결과 처리
});
```

### 데이터베이스 트랜잭션

TypeORM이나 Prisma와 같은 ORM을 활용한 트랜잭션 기반 접근법:

```typescript
// TypeORM 트랜잭션 예시
await this.connection.transaction(async manager => {
  const userPoint = await manager.findOne(UserPoint, userId);
  if (userPoint.point < amount) throw new Error();
  userPoint.point -= amount;
  await manager.save(userPoint);
});
```

## 6. 성능 고려사항

실제 시스템 구현 시 다음 요소들을 고려해야 합니다:

* **락 획득 시간 최소화**: 락을 보유하는 시간을 최소화하여 처리량 증가
* **타임아웃 전략**: 무한 대기 방지를 위한 락 획득 타임아웃 설정
* **데드락 방지**: 락 획득 순서 일관성 유지 및 타임아웃 활용
* **모니터링**: 락 획득/해제 패턴 모니터링을 통한 병목 지점 식별

## 7. 결론 및 향후 방향

현재 구현은 단일 서버 환경에서의 사용자별 동시성 제어에 최적화되어 있습니다. 이 접근법의 주요 이점은:

1. **구현 단순성**: 직관적인 API로 빠른 개발 가능
2. **높은 성능**: 단일 서버 환경에서 최소한의 오버헤드
3. **유지보수 용이성**: 명확한 코드 구조와 높은 가독성

시스템 규모 확장에 따라 고려해야 할 향후 방향:

* **Redis 기반 분산 락**: 다중 서버 환경으로 확장 시
* **성능 모니터링 강화**: 락 경합 패턴 분석 및 최적화
* **하이브리드 접근법**: 작업 특성에 따른 다양한 동시성 전략 조합

TypeScript와 Node.js 생태계는 지속적으로 발전하고 있으며, 동시성 제어 메커니즘 또한 시스템 요구사항과 함께 진화해야 합니다. 현재 구현은 시스템의 현재 규모와 요구사항에 가장 적합한 방식이라고 생각합니다.

---
export interface IPointLock {
  acquire(userId: number): Promise<() => void>;
}
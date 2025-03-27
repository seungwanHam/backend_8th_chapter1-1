export interface IResourceLock {
  acquire(resourceId: number): Promise<() => void>;
}
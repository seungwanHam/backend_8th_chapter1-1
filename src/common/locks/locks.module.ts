import { Module } from '@nestjs/common';
import { MemoryResourceLock } from './memory-lock';

@Module({
  providers: [MemoryResourceLock],
  exports: [MemoryResourceLock],
})
export class LocksModule { }
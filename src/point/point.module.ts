import { Module } from "@nestjs/common";
import { PointController } from "./point.controller";
import { DatabaseModule } from "../database/database.module";
import { PointService } from "./point.service";
import { MemoryResourceLock } from "../common/locks/memory-lock";
import { LocksModule } from "../common/locks/locks.module";
@Module({
  imports: [DatabaseModule, LocksModule],
  controllers: [PointController],
  providers: [
    PointService,
    {
      provide: 'POINT_LOCK',
      useExisting: MemoryResourceLock,
    }
  ],
})

export class PointModule { }
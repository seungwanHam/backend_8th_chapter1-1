import { Module } from "@nestjs/common";
import { PointController } from "./point.controller";
import { DatabaseModule } from "../database/database.module";
import { PointService } from "./point.service";
import { MemoryPointLock } from "./lock/memory-lock";
@Module({
  imports: [DatabaseModule],
  controllers: [PointController],
  providers: [
    PointService,
    MemoryPointLock,
    {
      provide: 'POINT_LOCK',
      useClass: MemoryPointLock,
    }
  ],
})

export class PointModule { }
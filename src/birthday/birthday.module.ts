import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BirthdayService } from "./birthday.service";
import { BirthdayScheduler } from "./birthday.scheduler/birthday.scheduler";
import { EmailService } from "../email/email.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [BirthdayService, BirthdayScheduler, EmailService],
  exports: [BirthdayService, EmailService],
})
export class BirthdayModule {}

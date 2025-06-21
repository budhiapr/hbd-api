import { Injectable, Logger, OnModuleInit } from "@nestjs/common"; // Use OnModuleInit for initial recovery
import { Cron, CronExpression } from "@nestjs/schedule";
import { BirthdayService } from "../birthday.service";

@Injectable()
export class BirthdayScheduler implements OnModuleInit {
  private readonly logger = new Logger(BirthdayScheduler.name);

  constructor(private birthdayService: BirthdayService) {}

  // Run the main processing logic every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.debug("Hourly cron job triggered: Checking for birthdays...");
    await this.birthdayService.processBirthdayMessages();
  }

  // Run recovery check once the application module is initialized
  async onModuleInit() {
    this.logger.log(
      "Application module initialized. Running initial recovery check..."
    );
    await this.birthdayService.recoverUnsentMessages();
  }
}

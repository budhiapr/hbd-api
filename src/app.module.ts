import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { UserModule } from "./user/user.module";
import { TimezoneUtil } from "./utils/timezone.util";
import { HttpModule } from "@nestjs/axios";
import { EmailModule } from "./email/email.module";
import { BirthdayModule } from "./birthday/birthday.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 3,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 20,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    ScheduleModule.forRoot(),
    UserModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    EmailModule,
    BirthdayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    TimezoneUtil,
  ],
  exports: [TimezoneUtil],
})
export class AppModule {}

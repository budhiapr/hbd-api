import { Injectable, Logger } from "@nestjs/common";
import { DateTime } from "luxon";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BirthdayService {
  private readonly logger = new Logger(BirthdayService.name);
  private readonly MAX_RETRIES = 5; // Maximum retries
  private readonly RETRY_INTERVAL_MS = 60 * 60 * 1000; // Retry every hour

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  async processBirthdayMessages() {
    this.logger.log("Starting birthday message processing...");

    const users = await this.prisma.user.findMany();
    const now = new Date();
    const currentYear = now.getFullYear();

    for (const user of users) {
      //   const userBirthday = DateTime.fromJSDate(user.birthday, { zone: "utc" });
      const nowInUserTimezone = DateTime.now().setZone(user.location);
      const storedBirthdayInUserTimezone = DateTime.fromJSDate(user.birthday, {
        zone: user.location,
      });
      const userEmail = user.email;

      // Check if it's the user's birthday in their local timezone today
      if (
        storedBirthdayInUserTimezone.month === nowInUserTimezone.month &&
        storedBirthdayInUserTimezone.day === nowInUserTimezone.day
      ) {
        // Find or create a message log for this specific birthday and year
        let messageLog = await this.prisma.messageLog.findFirst({
          where: {
            userId: user.id,
            birthdayMonth: storedBirthdayInUserTimezone.month,
            birthdayDay: storedBirthdayInUserTimezone.day,
            birthdayYear: storedBirthdayInUserTimezone.year,
          },
        });

        // If no log exists for this year's birthday, create one with PENDING status
        if (!messageLog) {
          messageLog = await this.prisma.messageLog.create({
            data: {
              userId: user.id,
              birthdayMonth: storedBirthdayInUserTimezone.month,
              birthdayDay: storedBirthdayInUserTimezone.day,
              birthdayYear: storedBirthdayInUserTimezone.year,
              status: "PENDING",
            },
          });

          this.logger.log(
            `Created new message log for ${user.firstName} ${user.lastName} (ID: ${messageLog.id})`
          );
        }

        // Only process if status is PENDING or FAILED (and not exceeding max retries)
        if (
          (messageLog.status === "PENDING" || messageLog.status === "FAILED") &&
          messageLog.attemptCount < this.MAX_RETRIES
        ) {
          // Check if current hour in user's timezone is 9 AM
          // And if enough time has passed since last attempt for FAILED messages
          const shouldAttemptNow =
            (nowInUserTimezone.hour === 9 && messageLog.status === "PENDING") ||
            (messageLog.status === "FAILED" &&
              messageLog.lastAttemptAt &&
              now.getTime() - messageLog.lastAttemptAt.getTime() >=
                this.RETRY_INTERVAL_MS);

          if (shouldAttemptNow) {
            this.logger.log(
              `Processing message for ${user.firstName} ${user.lastName} (Status: ${messageLog.status}, Attempts: ${messageLog.attemptCount})`
            );

            const fullName = `${user.firstName} ${user.lastName}`;
            await this.emailService.sendBirthdayEmail(
              fullName,
              userEmail,
              messageLog.id
            );
          } else if (
            messageLog.status === "PENDING" &&
            nowInUserTimezone.hour !== 9
          ) {
            this.logger.debug(
              `User ${user.firstName} ${user.lastName} is having birthday, but current hour in their timezone (${user.location}) is ${nowInUserTimezone.hour}. Waiting for 9 AM.`
            );
          } else if (
            messageLog.status === "FAILED" &&
            messageLog.attemptCount >= this.MAX_RETRIES
          ) {
            this.logger.warn(
              `Max retries reached for ${user.firstName} ${user.lastName}'s birthday message (Log ID: ${messageLog.id}). Status: FAILED.`
            );
          } else if (
            messageLog.status === "FAILED" &&
            messageLog.lastAttemptAt &&
            now.getTime() - messageLog.lastAttemptAt.getTime() <
              this.RETRY_INTERVAL_MS
          ) {
            this.logger.debug(
              `Waiting for retry interval for ${user.firstName} ${user.lastName}'s failed message.`
            );
          }
        } else if (messageLog.status === "SENT") {
          this.logger.debug(
            `Birthday message already SENT for ${user.firstName} ${user.lastName} (Log ID: ${messageLog.id}).`
          );
        }
      }
    }
    this.logger.log("Birthday message processing finished.");
  }

  // Recovery mechanism: Called on application start or periodically
  async recoverUnsentMessages() {
    this.logger.log("Starting recovery check for unsent birthday messages...");
    const now = new Date();
    const currentYear = now.getFullYear();

    // Find all message logs that are FAILED or PENDING (for current year's birthday)
    // and where last attempt was long enough ago for a retry.
    // Or PENDING for a day that hasn't been attempted yet.
    const messagesToRecover = await this.prisma.messageLog.findMany({
      where: {
        AND: [
          {
            birthdayYear: currentYear,
          },
          {
            OR: [
              { status: "PENDING" },
              {
                status: "FAILED",
                attemptCount: { lt: this.MAX_RETRIES },
                lastAttemptAt: {
                  lte: new Date(now.getTime() - this.RETRY_INTERVAL_MS),
                }, // Last attempt was long ago
              },
            ],
          },
        ],
        // Optionally, filter by birthdayMonth and birthdayDay to limit recovery scope
        // to today's or recent past birthdays if service was down for a short period.
        // For 'a day' downtime, we might only need to check yesterday and today.
        // This makes it simpler: we assume processBirthdayMessages will catch these.
        // The main goal here is to ensure *all* relevant messages get a chance.
      },
      include: { user: true }, // Include user data for sending email
    });

    if (messagesToRecover.length === 0) {
      this.logger.log("No unsent messages found for recovery.");
      return;
    }

    this.logger.log(
      `Found ${messagesToRecover.length} unsent messages to attempt recovery.`
    );

    for (const messageLog of messagesToRecover) {
      // Ensure it's currently their birthday in their timezone for *this year* for initial send or final retry
      const user = messageLog.user;
      const storedBirthdayInUserTimezone = DateTime.fromJSDate(user.birthday, {
        zone: user.location,
      });
      const nowInUserTimezone = DateTime.now().setZone(user.location);

      const isCurrentBirthday =
        storedBirthdayInUserTimezone.month === nowInUserTimezone.month &&
        storedBirthdayInUserTimezone.day === nowInUserTimezone.day &&
        messageLog.birthdayYear === nowInUserTimezone.year; // Ensure it's for *this year's* birthday

      if (isCurrentBirthday && nowInUserTimezone.hour === 9) {
        this.logger.log(
          `Recovering birthday message for ${user.firstName} ${user.lastName} (Log ID: ${messageLog.id})`
        );
        await this.emailService.sendBirthdayEmail(
          `${user.firstName} ${user.lastName}`,
          user.email,
          messageLog.id
        );
      } else if (
        isCurrentBirthday &&
        nowInUserTimezone.hour !== 9 &&
        messageLog.status === "PENDING"
      ) {
        this.logger.debug(
          `User ${user.firstName} ${user.lastName} is having birthday, but current hour in their timezone (${user.location}) is ${nowInUserTimezone.hour}. Waiting for 9 AM for recovery.`
        );
      } else if (
        messageLog.status === "FAILED" &&
        messageLog.lastAttemptAt &&
        now.getTime() - messageLog.lastAttemptAt.getTime() <
          this.RETRY_INTERVAL_MS
      ) {
        this.logger.debug(
          `Waiting for retry interval for ${user.firstName} ${user.lastName}'s failed message during recovery.`
        );
      } else {
        this.logger.debug(
          `Skipping recovery for ${user.firstName} ${user.lastName} (Log ID: ${messageLog.id}) - not current birthday or not ready for retry.`
        );
      }
    }
    this.logger.log("Recovery check finished.");
  }
}

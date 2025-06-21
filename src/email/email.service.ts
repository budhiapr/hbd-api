import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private emailServiceBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    this.emailServiceBaseUrl =
      this.configService.get<string>("EMAIL_API_BASE_URL") ??
      "https://email-service.digitalenvision.com.au";
  }

  async sendBirthdayEmail(
    fullName: string,
    userEmail: string,
    messageLogId: string
  ): Promise<boolean> {
    const message = `Hey, ${fullName} it's your birthday.`;

    const payload = {
      email: userEmail,
      message: message,
    };
    let sentSuccessfully = false;

    // Update lastAttemptAt dan increment attemptCount
    await this.prisma.messageLog.update({
      where: { id: messageLogId },
      data: {
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    try {
      this.logger.log(
        `Attempting to send birthday message to ${fullName} (Log ID: ${messageLogId}).`
      );
      await axios.post(`${this.emailServiceBaseUrl}/send-email`, payload, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });
      sentSuccessfully = true;
      this.logger.log(`Successfully sent birthday message to ${fullName}.`);

      // Update status to SENT if success
      await this.prisma.messageLog.update({
        where: { id: messageLogId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null, // Clear any previous error
        },
      });
    } catch (error) {
      this.logger.log(
        `Failed to send birthday message to ${fullName}: ${error.message}`
      );

      // Update status to FAILED
      await this.prisma.messageLog.update({
        where: { id: messageLogId },
        data: {
          status: "FAILED",
          errorMessage: error.message || "Unknown error",
        },
      });
    }

    return sentSuccessfully;
  }
}

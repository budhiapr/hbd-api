import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "./email.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import axios from "axios";

jest.mock("axios");

describe("EmailService", () => {
  let service: EmailService;
  let mockConfigService: Partial<ConfigService>;
  let mockPrismaService: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "EMAIL_SERVICE_BASE_URL") {
          return "https://email-service.digitalenvision.com.au";
        }
        return null;
      }),
    };

    mockPrismaService = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should send birthday email and update MessageLog status to SENT on success", async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ status: 200 });

    const fullName = "John Doe";
    const email = "john.doe@example.com";
    const messageLogId = "some-log-id";

    const result = await service.sendBirthdayEmail(
      fullName,
      email,
      messageLogId
    );

    expect(axios.post).toHaveBeenCalledWith(
      "https://email-service.digitalenvision.com.au/send-email",
      {
        email,
        message: `Hey, ${fullName} it's your birthday.`,
      },
      expect.any(Object)
    );

    expect(mockPrismaService.messageLog.update).toHaveBeenCalledWith({
      where: { id: messageLogId },
      data: {
        lastAttemptAt: expect.any(Date),
        attemptCount: { increment: 1 },
      },
    });

    expect(mockPrismaService.messageLog.update).toHaveBeenCalledWith({
      where: { id: messageLogId },
      data: {
        status: "SENT",
        sentAt: expect.any(Date),
        errorMessage: null,
      },
    });

    expect(result).toBe(true);
  });

  it("should update MessageLog status to FAILED on error", async () => {
    (axios.post as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    const fullName = "Jane Doe";
    const email = "jane.doe@example.com";
    const messageLogId = "another-log-id";

    const result = await service.sendBirthdayEmail(
      fullName,
      email,
      messageLogId
    );

    expect(mockPrismaService.messageLog.update).toHaveBeenCalledWith({
      where: { id: messageLogId },
      data: {
        lastAttemptAt: expect.any(Date),
        attemptCount: { increment: 1 },
      },
    });

    expect(mockPrismaService.messageLog.update).toHaveBeenCalledWith({
      where: { id: messageLogId },
      data: {
        status: "FAILED",
        errorMessage: "Network error",
      },
    });

    expect(result).toBe(false);
  });
});

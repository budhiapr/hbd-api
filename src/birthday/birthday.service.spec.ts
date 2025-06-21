import { Test, TestingModule } from "@nestjs/testing";
import { BirthdayService } from "./birthday.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { User } from "@prisma/client";
import { DateTime } from "luxon";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";

describe("BirthdayService", () => {
  let service: BirthdayService;
  let mockPrismaService: DeepMockProxy<PrismaService>;
  let mockEmailService: DeepMockProxy<EmailService>;

  beforeEach(async () => {
    mockPrismaService = mockDeep<PrismaService>();
    mockEmailService = mockDeep<EmailService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<BirthdayService>(BirthdayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should process birthday messages for users with birthday today at 9 AM and send email", async () => {
    const today = DateTime.local();
    const testEmail = `testuser${Date.now()}@example.com`;

    const mockUser: User = {
      id: "user123",
      firstName: "Test",
      lastName: "User",
      email: testEmail,
      birthday: new Date(today.year, today.month - 1, today.day),
      location: today.zoneName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaService.user.findMany.mockResolvedValueOnce([mockUser]);
    mockPrismaService.messageLog.findFirst.mockResolvedValueOnce(null);
    mockPrismaService.messageLog.create.mockResolvedValueOnce({
      id: "log123",
      userId: mockUser.id,
      birthdayMonth: today.month,
      birthdayDay: today.day,
      birthdayYear: today.year,
      status: "PENDING",
      sentAt: null,
      lastAttemptAt: new Date(),
      attemptCount: 0,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockEmailService.sendBirthdayEmail.mockResolvedValueOnce(true);

    const mockNow = DateTime.local()
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      .setZone(mockUser.location, { keepLocalTime: true }) as DateTime<true>;
    jest.spyOn(DateTime, "now").mockReturnValue(mockNow);

    await service.processBirthdayMessages();

    expect(mockPrismaService.user.findMany).toHaveBeenCalled();
    expect(mockEmailService.sendBirthdayEmail).toHaveBeenCalledWith(
      `${mockUser.firstName} ${mockUser.lastName}`,
      mockUser.email,
      "log123"
    );
  });
});

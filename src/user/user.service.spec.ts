import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";
import { PrismaService } from "../prisma/prisma.service";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { NotFoundException } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { first } from "rxjs";
import { drain } from "agenda/dist/agenda/drain";

describe("UsersService", () => {
  let service: UserService;
  let mockPrisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    mockPrisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should return all user", async () => {
      const mockUser = [
        {
          id: "1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          birthday: new Date(),
          location: "Asia/Jakarta",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUser);

      const result = await service.findAll();
      expect(result).toEqual(mockUser);
    });
  });

  describe("findOne", () => {
    it("should return a user by ID", async () => {
      const mockUser = {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        birthday: new Date(),
        location: "Asia/Jakarta",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne("1");
      expect(result).toEqual(mockUser);
    });
  });

  describe("create", () => {
    it("should create a new user", async () => {
      const dto: CreateUserDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        birthday: new Date().toISOString(),
        location: "Asia/Jakarta",
      };

      const mockUser = {
        ...dto,
        id: "1",
        birthday: new Date(dto.birthday),
        createAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser as any);

      const result = await service.create(dto);
      expect(result).toEqual(mockUser);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          birthday: new Date(dto.birthday),
          location: dto.location,
        },
      });
    });
  });

  describe("update", () => {
    it("should update an existing user", async () => {
      const id = "user-123456";
      const dto: UpdateUserDto = {
        firstName: "Updated first name",
        lastName: "Updated last name",
        email: "updated@example.com",
        birthday: new Date("2000-01-01").toISOString(),
        location: "Asia/Jakarta",
      };

      const updatedUser = {
        id,
        ...dto,
        birthday: new Date(dto.birthday ?? "2000-01-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.update(id, dto);
      expect(result).toEqual(updatedUser);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          birthday: new Date(dto.birthday ?? "2000-01-01"),
          location: dto.location,
        },
      });
    });

    it("should throw NotFoundException if user does not exist", async () => {
      const id = "non-exist-id";
      const dto: UpdateUserDto = {
        firstName: "X",
        lastName: "Y",
        email: "x@y.com",
        birthday: new Date().toISOString(),
        location: "Asia/Jakarta",
      };

      mockPrisma.user.update.mockRejectedValue({ code: "P2025" });
      await expect(service.update(id, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should delete a user", async () => {
      const id = "user-123456";

      mockPrisma.user.delete.mockResolvedValue({
        id,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        birthday: new Date("2000-01-01"),
        location: "Asia/Jakarta",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.remove(id);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id },
      });
    });

    it("should throw NotFoundException if user does not exist", async () => {
      const id = "invalid-user-id";

      mockPrisma.user.delete.mockRejectedValue({ code: "P2025" });
      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    });
  });
});

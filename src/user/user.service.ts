import { Injectable, NotFoundException, Req, Res } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { PrismaService } from "../prisma/prisma.service";
import { User } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUserDto: CreateUserDto): Promise<User> {
    return await this.prisma.user.create({
      data: {
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        email: createUserDto.email,
        birthday: new Date(createUserDto.birthday),
        location: createUserDto.location,
      },
    });
  }

  async findAll(): Promise<User[]> {
    return await this.prisma.user.findMany();
  }

  async findOne(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          firstName: updateUserDto.firstName,
          lastName: updateUserDto.lastName,
          email: updateUserDto.email,
          birthday: updateUserDto.birthday
            ? new Date(updateUserDto.birthday)
            : undefined,
          location: updateUserDto.location,
        },
      });
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundException(`User with ID "${id}" not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundException(`User with ID "${id}" not found`);
      }
      throw error;
    }
  }

  async findBirthdayUsers(checkDate: Date, hour: number): Promise<User[]> {
    const users = await this.prisma.user.findMany();

    const birthdayUsers: User[] = [];
    for (const user of users) {
      const userBirthday = user.birthday;
      const userLocation = user.location;

      const zoneNow = this.getZonedDate(checkDate, userLocation);
      const zoneBirthday = this.getZonedDate(userBirthday, userLocation);

      if (
        zoneNow.getMonth() === zoneBirthday.getMonth() &&
        zoneNow.getDate() === zoneBirthday.getDate() &&
        zoneNow.getHours() === hour
      ) {
        birthdayUsers.push(user);
      }
    }

    return birthdayUsers;
  }

  private getZonedDate(date: Date, timezone: string): Date {
    try {
      return toZonedTime(date, timezone);
    } catch (e) {
      console.warn(
        `Invalid timezone: ${timezone}. Falling back to UTC for date: ${date.toISOString()}`
      );
      return date;
    }
  }
}

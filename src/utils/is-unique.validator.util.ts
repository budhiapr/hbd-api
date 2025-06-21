// src/common/validators/is-unique.validator.ts

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { PrismaClient } from "@prisma/client"; // Import PrismaClient untuk tipenya

// Tentukan tipe PrismaClient dengan properti model yang dapat diakses
// Ini membantu TypeScript memahami properti dinamis pada `this.prisma`
type PrismaClientModels = {
  [K in keyof PrismaClient]: K extends "$" // Abaikan properti yang dimulai dengan '$' (internal methods)
    ? never
    : PrismaClient[K] extends { count: any } // Pastikan properti tersebut memiliki metode 'count'
    ? K
    : never;
}[keyof PrismaClient];

@ValidatorConstraint({ async: true }) // Penting: ini adalah validasi asinkron karena berinteraksi dengan database
@Injectable() // Penting: agar bisa di-inject ke NestJS Dependency Injection
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Metode utama untuk melakukan validasi.
   * @param value Nilai yang divalidasi (misalnya, alamat email)
   * @param args Argumen validasi, termasuk nama model dan properti yang diteruskan dari dekorator
   * @returns Promise<boolean> true jika nilai unik, false jika tidak
   */
  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const [model, property] = args.constraints; // Menerima nama model dan properti dari dekorator @IsUnique()

    // Jika nilai kosong atau undefined, biarkan validator lain (seperti @IsNotEmpty, @IsOptional) yang menanganinya
    if (!value) {
      return true;
    }

    let count: number;

    // Menggunakan if/else if untuk secara eksplisit mengakses properti model pada PrismaService
    // Ini membantu TypeScript memahami bahwa metode .count() memang ada pada properti tersebut.
    // Pastikan string 'user' atau 'messageLog' sesuai dengan nama properti model di PrismaClient (biasanya lowercase).
    if (model === "User" || model === "user") {
      count = await this.prisma.user.count({
        where: {
          [property]: value, // Mengecek keunikan berdasarkan properti dan nilai yang diberikan
        },
      });
    } else if (model === "MessageLog" || model === "messageLog") {
      count = await this.prisma.messageLog.count({
        where: {
          [property]: value,
        },
      });
    } else {
      // Jika nama model tidak dikenali, lemparkan error untuk debugging
      throw new Error(
        `Model "${model}" is not configured for IsUnique validation.`
      );
    }

    // Jika count adalah 0, berarti nilai tersebut unik
    return count === 0;
  }

  /**
   * Mengembalikan pesan error default jika validasi gagal.
   * @param args Argumen validasi
   * @returns String pesan error
   */
  defaultMessage(args: ValidationArguments): string {
    const [model, property] = args.constraints;
    return `${property} "${args.value}" sudah terdaftar di ${model}.`;
  }
}

/**
 * Dekorator kustom untuk memeriksa keunikan nilai dalam database.
 * Digunakan pada properti DTO.
 *
 * @param model Nama model Prisma (misalnya, 'User', 'MessageLog') yang akan diperiksa keunikannya.
 * Nama ini harus sesuai dengan nama properti model di `this.prisma`.
 * @param property Nama kolom di model yang harus unik (misalnya, 'email').
 * @param validationOptions Opsi validasi tambahan dari class-validator.
 * @returns Fungsi dekorator.
 */
export function IsUnique(
  model: string,
  property: string,
  validationOptions?: ValidationOptions
) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [model, property], // Meneruskan model dan properti ke IsUniqueConstraint
      validator: IsUniqueConstraint,
    });
  };
}

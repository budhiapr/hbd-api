import { Injectable } from "@nestjs/common";

@Injectable() // Menandakan bahwa kelas ini dapat di-inject sebagai dependensi
export class AppService {
  getHello(): string {
    return "Hello World!"; // Mengembalikan string "Hello World!"
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Injectable()
export class NotifyService {
  constructor(private prisma: PrismaService) {}

  async send(userId: string, title: string, body: string, type = "INFO", meta?: object) {
    return this.prisma.notification.create({
      data: { userId, title, body, type, meta: meta as object | undefined },
    });
  }
}

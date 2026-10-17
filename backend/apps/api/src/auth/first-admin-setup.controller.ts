import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FirstAdminSetupInput, FirstAdminSetupService } from "./first-admin-setup.service";

@Controller("setup/first-admin")
export class FirstAdminSetupController {
  constructor(private readonly setup: FirstAdminSetupService) {}

  @Get("status")
  async status() {
    return { available: await this.setup.isAvailable() };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  create(@Body() body: FirstAdminSetupInput) {
    return this.setup.createFirstAdmin(body);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { CrmScopeGuard } from "./crm-scope.guard";
import { CrmService } from "./crm.service";
import { LeadStatus } from "@prisma/client";

@Controller("v1/crm")
@UseGuards(JwtAuthGuard, PermissionGuard, CrmScopeGuard)
export class CrmController {
  constructor(private crm: CrmService) {}

  @Get("pipeline")
  @RequirePermission("lead.view")
  pipeline(
    @Req() req: Request & { user: AuthUser },
    @Query() q: { q?: string; source?: string; priority?: string; assignedUserId?: string; archived?: string },
  ) {
    return this.crm.pipeline(req.user, q);
  }

  @Get("stats")
  @RequirePermission("lead.view")
  stats(@Req() req: Request & { user: AuthUser }) {
    return this.crm.stats(req.user);
  }

  @Get("duplicates")
  @RequirePermission("lead.view")
  duplicates(@Req() req: Request & { user: AuthUser }, @Query() q: { mobile?: string; email?: string; cnic?: string; excludeId?: string }) {
    return this.crm.duplicates(req.user, q.mobile, q.email, q.cnic, q.excludeId);
  }

  @Get("customer-duplicates")
  @RequirePermission("customer.view")
  customerDuplicates(
    @Req() req: Request & { user: AuthUser },
    @Query() q: { phone?: string; email?: string; cnic?: string; passport?: string; excludeId?: string },
  ) {
    return this.crm.customerDuplicates(req.user, q.phone, q.email, q.cnic, q.passport, q.excludeId);
  }

  @Get("quotations")
  @RequirePermission("quotation.view")
  listQuotes(@Req() req: Request & { user: AuthUser }, @Query() q: { q?: string; status?: string }) {
    return this.crm.listQuotations(req.user, q.q, q.status);
  }

  @Post("quotations")
  @RequirePermission("quotation.create")
  createQuote(@Body() body: { customerId?: string; leadId?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.createQuotation(req.user, body);
  }

  @Get("passengers")
  @RequirePermission("passenger.view")
  passengers(@Req() req: Request & { user: AuthUser }, @Query() q: { q?: string }) {
    return this.crm.listPassengers(req.user, q.q);
  }

  @Get("today")
  @RequirePermission("lead.view")
  today(@Req() req: Request & { user: AuthUser }) {
    return this.crm.today(req.user);
  }

  @Post("leads/import")
  @RequirePermission("lead.create")
  importRows(@Body() body: { rows: Record<string, string>[] }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.importLeads(req.user, body.rows ?? []);
  }

  @Post("leads/bulk")
  @RequirePermission("lead.edit")
  bulk(
    @Body() body: { ids: string[]; action: string; assignedUserId?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.bulk(req.user, body.ids ?? [], body.action, body.assignedUserId);
  }

  @Get("follow-ups/upcoming")
  @RequirePermission("followup.view")
  upcoming(@Req() req: Request & { user: AuthUser }) {
    return this.crm.upcomingFollowUps(req.user);
  }

  @Get("leads/:id/workspace")
  @RequirePermission("lead.view")
  workspace(@Param("id") id: string) {
    return this.crm.workspace(id);
  }

  @Post("leads/:id/notes")
  @RequirePermission("lead.edit")
  note(@Param("id") id: string, @Body() body: { body?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.addNote(id, req.user, body.body ?? "");
  }

  @Post("leads/:id/assign")
  @RequirePermission("lead.assign")
  assign(
    @Param("id") id: string,
    @Body() body: { assignedUserId?: string; assignedAgentId?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.assign(id, req.user, body.assignedUserId, body.assignedAgentId);
  }

  @Post("leads/:id/status")
  @RequirePermission("lead.edit")
  status(@Param("id") id: string, @Body() body: { status: LeadStatus; lostReason?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.setStatus(id, req.user, body.status, body.lostReason);
  }

  @Post("leads/:id/follow-ups")
  @RequirePermission("followup.create")
  followUp(
    @Param("id") id: string,
    @Body() body: { dueAt: string; type?: string; subject: string; notes?: string; priority?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.addFollowUp(id, req.user, body);
  }

  @Post("leads/:id/tasks")
  @RequirePermission("task.create")
  task(
    @Param("id") id: string,
    @Body() body: { title: string; description?: string; dueDate?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.addTask(id, req.user, body);
  }

  @Post("leads/:id/communications")
  @RequirePermission("lead.edit")
  comms(
    @Param("id") id: string,
    @Body() body: { channel: string; subject?: string; message: string; send?: boolean },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.logCommunication(id, req.user, body);
  }

  @Post("leads/:id/quotation")
  @RequirePermission("quotation.create")
  quote(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.crm.quoteFromLead(id, req.user);
  }

  @Post("leads/:id/booking")
  @RequirePermission("booking.create")
  booking(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.crm.bookingFromLead(id, req.user);
  }

  @Post("leads/:id/archive")
  @RequirePermission("lead.edit")
  archive(@Param("id") id: string, @Body() body: { archived?: boolean }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.archive(id, req.user, body.archived !== false);
  }

  @Post("follow-ups/:id/status")
  @RequirePermission("followup.edit")
  followStatus(@Param("id") id: string, @Body() body: { status: "COMPLETED" | "MISSED" | "CANCELLED" | "PENDING" }) {
    return this.crm.setFollowUpStatus(id, body.status);
  }

  @Post("tasks/:id/status")
  @RequirePermission("task.edit")
  taskStatus(@Param("id") id: string, @Body() body: { status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }) {
    return this.crm.setTaskStatus(id, body.status);
  }

  @Get("quotations/:id")
  @RequirePermission("quotation.view")
  quotation(@Param("id") id: string) {
    return this.crm.quotationWorkspace(id);
  }

  @Post("quotations/:id/send")
  @RequirePermission("quotation.edit")
  sendQuote(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.crm.sendQuotation(id, req.user);
  }

  @Post("leads/:id/merge")
  @RequirePermission("lead.edit")
  merge(@Param("id") id: string, @Body() body: { otherId?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.mergeLeads(id, body.otherId ?? "", req.user);
  }

  @Post("follow-ups/:id/reschedule")
  @RequirePermission("followup.edit")
  reschedule(@Param("id") id: string, @Body() body: { dueAt: string }) {
    return this.crm.rescheduleFollowUp(id, body.dueAt);
  }

  @Post("customers/:id/quotation")
  @RequirePermission("quotation.create")
  customerQuote(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.crm.quoteFromCustomer(id, req.user);
  }

  @Patch("customers/:id")
  @RequirePermission("customer.edit")
  updateCustomer(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthUser }) {
    return this.crm.updateCustomer(id, req.user, body);
  }

  @Post("customers/:id/communications")
  @RequirePermission("customer.edit")
  customerComms(
    @Param("id") id: string,
    @Body() body: { channel: string; subject?: string; message: string; send?: boolean },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.logCustomerCommunication(id, req.user, body);
  }

  @Post("customers/:id/follow-ups")
  @RequirePermission("followup.create")
  customerFollowUp(
    @Param("id") id: string,
    @Body() body: { dueAt: string; type?: string; subject: string; notes?: string; priority?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.addCustomerFollowUp(id, req.user, body);
  }

  @Post("customers/:id/tasks")
  @RequirePermission("task.create")
  customerTask(
    @Param("id") id: string,
    @Body() body: { title: string; description?: string; dueDate?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.addCustomerTask(id, req.user, body);
  }

  @Post("quotations/:id/status")
  @RequirePermission("quotation.edit")
  quoteStatus(@Param("id") id: string, @Body() body: { status: string }, @Req() req: Request & { user: AuthUser }) {
    return this.crm.setQuotationStatus(id, body.status, req.user);
  }

  @Post("leads/:id/convert")
  @RequirePermission("lead.edit")
  convert(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.crm.convertLead(id, req.user);
  }

  @Post("customers/:id/booking")
  @RequirePermission("booking.create")
  customerBooking(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.crm.bookingFromCustomer(id, req.user);
  }

  @Patch("leads/:id")
  @RequirePermission("lead.edit")
  updateLead(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthUser }) {
    return this.crm.updateLead(id, req.user, body);
  }

  @Patch("quotations/:id")
  @RequirePermission("quotation.edit")
  patchQuote(
    @Param("id") id: string,
    @Body() body: { discount?: number; tax?: number; terms?: string; notes?: string; expiresAt?: string; currency?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.updateQuotation(id, req.user, body);
  }

  @Delete("quotations/:id/items/:itemId")
  @RequirePermission("quotation.edit")
  removeItem(@Param("id") id: string, @Param("itemId") itemId: string) {
    return this.crm.removeQuoteItem(id, itemId);
  }

  @Post("quotations/:id/items")
  @RequirePermission("quotation.edit")
  addItem(
    @Param("id") id: string,
    @Body() body: { description: string; quantity?: number; sellingPrice?: number; cost?: number },
  ) {
    return this.crm.addQuoteItem(id, body);
  }

  @Post("customers/:id/passengers")
  @RequirePermission("passenger.create")
  addPax(
    @Param("id") id: string,
    @Body() body: {
      fullName: string;
      fatherName?: string;
      passportNumber?: string;
      mobile?: string;
      whatsapp?: string;
      email?: string;
      gender?: "MALE" | "FEMALE" | "OTHER";
      cnic?: string;
      nationality?: string;
      address?: string;
      emergencyContact?: string;
      dateOfBirth?: string;
      passportExpiryDate?: string;
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.crm.addPassenger(id, req.user, body);
  }

  @Get("customers/:id/workspace")
  @RequirePermission("customer.view")
  customer(@Param("id") id: string) {
    return this.crm.customerWorkspace(id);
  }
}


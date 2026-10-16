import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaService } from "./common/prisma.service";
import { SequenceService } from "./common/sequence.service";
import { AuditService } from "./common/audit.service";
import { NotifyService } from "./common/notify.service";
import { StorageService } from "./common/storage.service";
import { MailService } from "./common/mail.service";
import { WhatsAppService } from "./common/whatsapp.service";
import { AuthController } from "./auth/auth.controller";
import { JwtAuthGuard } from "./auth/jwt.guard";
import { PermissionGuard } from "./auth/permission.guard";
import { ResourcesService } from "./resources/resources.service";
import { ResourcesController } from "./resources/resources.controller";
import { DashboardController } from "./dashboard/dashboard.controller";
import { FinanceController } from "./finance/finance.controller";
import { AccountingService } from "./finance/accounting.service";
import { WorkflowsController } from "./workflows/workflows.controller";
import { SettingsController } from "./settings/settings.controller";
import { DocumentsController, PdfController } from "./documents/documents.controller";
import { DocumentPdfService } from "./documents/document-pdf.service";
import { CrmController } from "./crm/crm.controller";
import { CrmService } from "./crm/crm.service";
import { PeopleOcrService } from "./crm/people-ocr.service";
import { OcrController } from "./crm/ocr.controller";
import { HealthController } from "./health.controller";
import { ReservationController } from "./reservation/reservation.controller";
import { ReservationService } from "./reservation/reservation.service";
import { UmrahOpsController } from "./umrah/umrah-ops.controller";
import { UmrahOpsService } from "./umrah/umrah-ops.service";
import { ComplaintsController } from "./complaints/complaints.controller";
import { ComplaintsService } from "./complaints/complaints.service";
import { ReportsController, ExportController, ImportController, CommsController, RbacController, PublicController } from "./reports/misc.controller";
import { ReportsService } from "./reports/reports.service";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { WebsiteCustomerBookingsController } from "./website/website-customer-bookings.controller";
import { WebsiteCustomerBookingsService } from "./website/website-customer-bookings.service";
import { WebsiteLeadsController } from "./website/website-leads.controller";
import { WebsiteCustomerUpsertController } from "./website/website-customer-upsert.controller";
import { WebsiteCustomerUpsertService } from "./website/website-customer-upsert.service";
import { WebsiteCustomerWriteGuard } from "./website/website-customer-write.guard";

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 120 }] }),
  ],
  controllers: [
    AuthController,
    DashboardController,
    FinanceController,
    WorkflowsController,
    SettingsController,
    DocumentsController,
    PdfController,
    ReportsController,
    AdminController,
    ExportController,
    ImportController,
    CommsController,
    RbacController,
    PublicController,
    CrmController,
    OcrController,
    UmrahOpsController,
    ReservationController,
    ComplaintsController,
    WebsiteLeadsController,
    WebsiteCustomerBookingsController,
    WebsiteCustomerUpsertController,
    ResourcesController,
    HealthController,
  ],
  providers: [
    PrismaService,
    SequenceService,
    AuditService,
    NotifyService,
    StorageService,
    MailService,
    WhatsAppService,
    JwtAuthGuard,
    PermissionGuard,
    ResourcesService,
    AccountingService,
    CrmService,
    PeopleOcrService,
    ReservationService,
    UmrahOpsService,
    ComplaintsService,
    ReportsService,
    AdminService,
    DocumentPdfService,
    WebsiteCustomerBookingsService,
    WebsiteCustomerUpsertService,
    WebsiteCustomerWriteGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

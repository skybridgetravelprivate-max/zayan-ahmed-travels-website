import {
  parseContent,
  mediaIds,
} from "../../../../packages/config/website-content.cjs";
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { StorageService } from "../common/storage.service";
import { AuditService } from "../common/audit.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthUser, can } from "../auth/auth.types";
import { ManagementOriginGuard } from "../management/management.guard";
import { WebsiteCmsService, CMS_LOCK } from "./website-cms.service";

@Controller("v1/website/media")
@UseGuards(JwtAuthGuard, ManagementOriginGuard)
export class WebsiteMediaController {
  constructor(
    private db: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
  ) {}
  private check(user: AuthUser, edit = false) {
    if (!can(user, edit ? "cms.edit" : "cms.view"))
      throw new ForbiddenException();
  }
  @Get() async list(@Req() req: Request & { user: AuthUser }) {
    this.check(req.user);
    return this.db.cmsMedia.findMany({
      take: 500,
      orderBy: { id: "desc" },
      select: { id: true, alt: true, documentId: true },
    });
  }
  @Post() async add(
    @Body() body: { documentId?: unknown; alt?: unknown },
    @Req() req: Request & { user: AuthUser },
  ) {
    this.check(req.user, true);
    if (
      typeof body.documentId !== "string" ||
      typeof body.alt !== "string" ||
      !body.alt.trim() ||
      body.alt.length > 200
    )
      throw new BadRequestException("Image and alternative text required");
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CMS_LOCK})`;
      const doc = await tx.storedDocument.findUnique({
        where: { id: body.documentId as string },
      });
      if (
        !doc ||
        doc.entityType !== "cmsPage" ||
        !["image/png", "image/jpeg", "image/webp"].includes(doc.mimeType)
      )
        throw new NotFoundException();
      const existing = await tx.cmsMedia.findFirst({
        where: { documentId: doc.id },
      });
      if (existing) return existing;
      const row = await tx.cmsMedia.create({
        data: { documentId: doc.id, alt: (body.alt as string).trim() },
      });
      await this.audit.log({
        userId: req.user.id,
        action: "cms.media.add",
        entity: "CmsMedia",
        entityId: row.id,
        after: { documentId: doc.id },
        db: tx,
      });
      return row;
    });
  }
  @Get(":id/preview") async preview(
    @Param("id") id: string,
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
  ) {
    this.check(req.user);
    const item = await this.db.cmsMedia.findUnique({ where: { id } });
    const doc =
      item &&
      (await this.db.storedDocument.findUnique({
        where: { id: item.documentId },
      }));
    if (
      !doc ||
      doc.entityType !== "cmsPage" ||
      !["image/png", "image/jpeg", "image/webp"].includes(doc.mimeType)
    )
      throw new NotFoundException();
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(await this.storage.get(doc.storageKey));
  }
  @Delete(":id") async remove(
    @Param("id") id: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    this.check(req.user, true);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CMS_LOCK})`;
      const pattern = `%/api/public/website/media/${id}%`;
      const rows = await tx.$queryRaw<
        { n: bigint }[]
      >`SELECT (SELECT count(*) FROM "CmsPage" WHERE "draft"::text LIKE ${pattern} OR "published"::text LIKE ${pattern}) + (SELECT count(*) FROM "CmsPageRevision" WHERE "content"::text LIKE ${pattern}) AS n`;
      if (Number(rows[0].n))
        throw new BadRequestException(
          "Image is retained by a draft, publication or revision",
        );
      const item = await tx.cmsMedia.findUnique({ where: { id } });
      if (!item) throw new NotFoundException();
      await tx.cmsMedia.delete({ where: { id } });
      await this.audit.log({
        userId: req.user.id,
        action: "cms.media.remove",
        entity: "CmsMedia",
        entityId: id,
        after: { privateObjectRetained: true },
        db: tx,
      });
      return { ok: true, privateObjectRetained: true };
    });
  }
}

@Controller("public/website")
export class PublicWebsiteController {
  constructor(
    private cms: WebsiteCmsService,
    private db: PrismaService,
    private storage: StorageService,
  ) {}
  @Get("pages") async pages(@Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    return this.cms.publicPages();
  }
  @Get("pages/:slug") async page(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.cms.publicPage(slug);
  }
  @Get("media/:id") async media(@Param("id") id: string, @Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new NotFoundException();
    const refs = await this.db.cmsPage.findMany({
      where: { status: "PUBLISHED" },
      select: { published: true },
    });
    if (
      !refs.some(
        (row) =>
          row.published && mediaIds(parseContent(row.published)).includes(id),
      )
    )
      throw new NotFoundException();
    const item = await this.db.cmsMedia.findUnique({ where: { id } });
    const doc =
      item &&
      (await this.db.storedDocument.findUnique({
        where: { id: item.documentId },
      }));
    if (
      !doc ||
      doc.entityType !== "cmsPage" ||
      !["image/png", "image/jpeg", "image/webp"].includes(doc.mimeType)
    )
      throw new NotFoundException();
    res.setHeader("Content-Type", doc.mimeType);
    res.send(await this.storage.get(doc.storageKey));
  }
}

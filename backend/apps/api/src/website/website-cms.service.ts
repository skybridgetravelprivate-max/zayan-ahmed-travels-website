import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, CmsPage } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, can } from "../auth/auth.types";
import {
  parseContent,
  mediaIds,
  WebsiteContent,
} from "../../../../packages/config/website-content.cjs";

export const CMS_LOCK = 820281;
export function cmsSlug(value: string) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(value))
    throw new BadRequestException("Invalid page slug");
  return value;
}
function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new BadRequestException("A page version is required");
  return value as number;
}
function content(value: unknown): WebsiteContent {
  try {
    return parseContent(value);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "Invalid website content",
    );
  }
}
const snapshot = (c: WebsiteContent) => c as unknown as Prisma.InputJsonObject;

@Injectable()
export class WebsiteCmsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}
  assert(user: AuthUser, publish = false) {
    if (!can(user, publish ? "cms.publish" : "cms.edit"))
      throw new ForbiddenException();
  }
  private view(user: AuthUser) {
    if (!can(user, "cms.view")) throw new ForbiddenException();
  }
  async list(user: AuthUser) {
    this.view(user);
    return this.prisma.cmsPage.findMany({
      orderBy: { slug: "asc" },
      take: 500,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        reviewState: true,
        version: true,
        publishedVersion: true,
        updatedAt: true,
      },
    });
  }
  async read(user: AuthUser, slug: string) {
    this.view(user);
    const page = await this.prisma.cmsPage.findUnique({
      where: { slug: cmsSlug(slug) },
      include: {
        revisions: {
          orderBy: { version: "desc" },
          take: 40,
          select: {
            version: true,
            action: true,
            userId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!page) throw new NotFoundException();
    return page;
  }
  async revisions(user: AuthUser, slug: string, before: unknown) {
    this.view(user);
    const cursor = version(before);
    const page = await this.prisma.cmsPage.findUnique({
      where: { slug: cmsSlug(slug) },
      select: { id: true },
    });
    if (!page) throw new NotFoundException();
    return this.prisma.cmsPageRevision.findMany({
      where: { pageId: page.id, version: { lt: cursor } },
      take: 40,
      orderBy: { version: "desc" },
      select: { version: true, action: true, userId: true, createdAt: true },
    });
  }
  private async checkMedia(tx: Prisma.TransactionClient, c: WebsiteContent) {
    const ids = mediaIds(c);
    if (
      ids.length &&
      (await tx.cmsMedia.count({ where: { id: { in: ids } } })) !== ids.length
    )
      throw new BadRequestException("A selected image is unavailable");
  }
  private async record(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    page: CmsPage,
    action: string,
    c: WebsiteContent,
  ) {
    await tx.cmsPageRevision.create({
      data: {
        pageId: page.id,
        version: page.version,
        action,
        userId: user.id,
        content: snapshot(c),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: `cms.${action.toLowerCase()}`,
      entity: "CmsPage",
      entityId: page.id,
      after: { slug: page.slug, version: page.version },
      db: tx,
    });
    return page;
  }
  async save(
    user: AuthUser,
    slug: string,
    input: { version?: unknown; content?: unknown },
  ) {
    this.assert(user);
    cmsSlug(slug);
    const expected = version(input?.version);
    const c = content(input?.content);
    if ((slug === "site-settings") !== !!c.settings)
      throw new BadRequestException(
        "Website settings belong only to site-settings",
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CMS_LOCK})`;
      const old = await tx.cmsPage.findUnique({ where: { slug } });
      if ((old?.version ?? 0) !== expected)
        throw new ConflictException("Page changed; reload before editing");
      await this.checkMedia(tx, c);
      const page = old
        ? await tx.cmsPage.update({
            where: { id: old.id },
            data: {
              draft: snapshot(c),
              reviewState: "DRAFT",
              version: { increment: 1 },
            },
          })
        : await tx.cmsPage.create({
            data: {
              slug,
              title: c.title,
              body: c.body,
              draft: snapshot(c),
              version: 1,
            },
          });
      return this.record(tx, user, page, "SAVE", c);
    });
  }
  async transition(
    user: AuthUser,
    slug: string,
    action: string,
    input: { version?: unknown; revision?: unknown },
  ) {
    if (!["review", "publish", "rollback", "unpublish"].includes(action))
      throw new BadRequestException("Unknown publishing action");
    this.assert(user, ["publish", "unpublish"].includes(action));
    cmsSlug(slug);
    const expected = version(input?.version);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CMS_LOCK})`;
      const old = await tx.cmsPage.findUnique({ where: { slug } });
      if (!old) throw new NotFoundException();
      if (old.version !== expected)
        throw new ConflictException("Page changed; reload before continuing");
      let c = content(old.draft);
      const data: Prisma.CmsPageUpdateInput = { version: { increment: 1 } };
      if (action === "review") data.reviewState = "REVIEW";
      if (action === "publish") {
        if (old.reviewState !== "REVIEW")
          throw new ConflictException(
            "Submit the saved draft for review first",
          );
        await this.checkMedia(tx, c);
        Object.assign(data, {
          published: snapshot(c),
          publishedVersion: expected + 1,
          title: c.title,
          body: c.body,
          status: "PUBLISHED",
          reviewState: "PUBLISHED",
        });
      }
      if (action === "rollback") {
        const revision = await tx.cmsPageRevision.findUnique({
          where: {
            pageId_version: {
              pageId: old.id,
              version: version(input.revision),
            },
          },
        });
        if (!revision) throw new NotFoundException("Revision unavailable");
        c = content(revision.content);
        await this.checkMedia(tx, c);
        Object.assign(data, { draft: snapshot(c), reviewState: "DRAFT" });
      }
      if (action === "unpublish")
        Object.assign(data, {
          published: Prisma.DbNull,
          publishedVersion: null,
          status: "DRAFT",
          reviewState: "DRAFT",
        });
      const page = await tx.cmsPage.update({ where: { id: old.id }, data });
      return this.record(tx, user, page, action.toUpperCase(), c);
    });
  }
  async publicPage(slug: string) {
    const row = await this.prisma.cmsPage.findUnique({
      where: { slug: cmsSlug(slug) },
      select: {
        slug: true,
        published: true,
        publishedVersion: true,
        status: true,
      },
    });
    if (!row || row.status !== "PUBLISHED" || !row.published)
      throw new NotFoundException();
    return {
      slug: row.slug,
      version: row.publishedVersion,
      content: content(row.published),
    };
  }
  async publicPages() {
    const rows = await this.prisma.cmsPage.findMany({
      where: { status: "PUBLISHED", slug: { not: "site-settings" } },
      orderBy: { slug: "asc" },
      take: 500,
      select: { slug: true, published: true, publishedVersion: true },
    });
    return rows
      .filter((row) => row.published)
      .map((row) => ({
        slug: row.slug,
        version: row.publishedVersion,
        content: content(row.published),
      }));
  }
}

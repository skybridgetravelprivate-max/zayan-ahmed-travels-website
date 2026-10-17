import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../common/prisma.service";
import { assertPasswordPolicy, hashPassword } from "../common/password";

const SETUP_TOKEN_ENV = "FIRST_ADMIN_SETUP_TOKEN";
const SETUP_TOKEN_MIN_LENGTH = 32;
const SETUP_TOKEN_MAX_LENGTH = 512;
const FIRST_ADMIN_LOCK_NAMESPACE = 208560943;
const FIRST_ADMIN_LOCK_ID = 1;

export type FirstAdminSetupInput = {
  setupToken?: unknown;
  email?: unknown;
  username?: unknown;
  fullName?: unknown;
  password?: unknown;
};

type ValidatedFirstAdminInput = {
  email: string;
  username: string;
  fullName: string;
  password: string;
};

function configuredSetupToken() {
  if (process.env.NODE_ENV !== "development") return null;
  const token = process.env[SETUP_TOKEN_ENV];
  if (
    !token ||
    token.length < SETUP_TOKEN_MIN_LENGTH ||
    token.length > SETUP_TOKEN_MAX_LENGTH
  ) {
    return null;
  }
  return token;
}

function tokenMatches(candidate: string, expected: string) {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function validateInput(input: FirstAdminSetupInput): ValidatedFirstAdminInput {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new BadRequestException("Enter a valid email address.");
  }
  if (username.length < 3 || username.length > 32 || !/^[a-z0-9._-]+$/.test(username)) {
    throw new BadRequestException("Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.");
  }
  if (!fullName || fullName.length > 100) {
    throw new BadRequestException("Enter a name up to 100 characters.");
  }

  assertPasswordPolicy(password);
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new BadRequestException("Password must be at most 72 UTF-8 bytes.");
  }
  return { email, username, fullName, password };
}

@Injectable()
export class FirstAdminSetupService {
  constructor(private readonly prisma: PrismaService) {}

  async isAvailable() {
    if (!configuredSetupToken()) return false;
    return (await this.prisma.user.count()) === 0;
  }

  async createFirstAdmin(input: FirstAdminSetupInput) {
    const expectedToken = configuredSetupToken();
    if (!expectedToken) throw new NotFoundException("Initial setup is unavailable.");

    const suppliedToken = typeof input.setupToken === "string" ? input.setupToken : "";
    if (
      suppliedToken.length < SETUP_TOKEN_MIN_LENGTH ||
      suppliedToken.length > SETUP_TOKEN_MAX_LENGTH ||
      !tokenMatches(suppliedToken, expectedToken)
    ) {
      throw new UnauthorizedException("Invalid setup token.");
    }

    const validated = validateInput(input);
    if ((await this.prisma.user.count()) !== 0) {
      throw new ConflictException("Initial administrator setup is already complete.");
    }
    const passwordHash = await hashPassword(validated.password);

    return this.prisma.$transaction(async (tx) => {
      // Prisma cannot deserialize PostgreSQL's void return type. Keep the
      // transaction-scoped lock, but return a supported text value.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${FIRST_ADMIN_LOCK_NAMESPACE}, ${FIRST_ADMIN_LOCK_ID})::text AS locked`;

      if ((await tx.user.count()) !== 0) {
        throw new ConflictException("Initial administrator setup is already complete.");
      }

      const role = await tx.role.upsert({
        where: { name: "SUPER_ADMIN" },
        update: { isSystem: true },
        create: {
          name: "SUPER_ADMIN",
          isSystem: true,
          description: "Initial system administrator",
        },
      });
      const dashboardPermission = await tx.permission.upsert({
        where: { code: "dashboard.view" },
        update: {},
        create: { code: "dashboard.view" },
      });
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: dashboardPermission.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: dashboardPermission.id },
      });

      const user = await tx.user.create({
        data: {
          email: validated.email,
          username: validated.username,
          fullName: validated.fullName,
          passwordHash,
          status: "ACTIVE",
        },
        select: { id: true, email: true, username: true, fullName: true },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

      return { ok: true as const, user };
    });
  }
}

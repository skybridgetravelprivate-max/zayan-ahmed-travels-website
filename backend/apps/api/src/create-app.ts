import "./env";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import type { INestApplication } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { HttpExceptionFilter } from "./common/http-exception.filter";

export async function createNestApp(): Promise<INestApplication> {
  console.log("DATABASE_URL present:", Boolean(process.env.DATABASE_URL));
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "v1/customer/bookings", method: RequestMethod.GET },
      { path: "v1/customer/upsert-by-email", method: RequestMethod.POST },
    ],
  });
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(cookieParser());
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  const origins = (process.env.APP_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      return res.status(403).json({ message: "Forbidden origin" });
    }
    return next();
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  await app.init();
  return app;
}

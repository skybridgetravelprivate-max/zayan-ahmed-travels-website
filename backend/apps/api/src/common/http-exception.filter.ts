import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const prod = process.env.NODE_ENV === "production";
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const body = typeof payload === "string" ? { statusCode: status, message: payload } : payload;
      return res.status(status).json(body);
    }
    console.error("Unhandled error:", prod ? (exception as Error)?.name : exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: prod ? "Internal server error" : String((exception as Error)?.message ?? exception),
    });
  }
}

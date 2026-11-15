import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid values.", requestId: request.requestId, details: error.issues } });
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, requestId: request.requestId, ...(error.details === undefined ? {} : { details: error.details }) } });
    return;
  }
  logger.error({ error, requestId: request.requestId, method: request.method, path: request.path }, "Unhandled API error");
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId: request.requestId } });
};

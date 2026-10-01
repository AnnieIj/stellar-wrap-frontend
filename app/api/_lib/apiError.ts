import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { LoggerInterface } from "@/app/utils/logger";

/** Stable error identifiers returned by the notification API. */
export type ApiErrorCode =
  | "INVALID_WALLET"
  | "INVALID_PUSH_SUBSCRIPTION"
  | "INVALID_EMAIL"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INVALID_CONFIRMATION_TOKEN"
  | "INVALID_UNSUBSCRIBE_TOKEN"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export function apiError(code: ApiErrorCode, message: string, status: number, requestId?: string) {
  return NextResponse.json(
    { error: message, code, ...(requestId ? { requestId } : {}) },
    { status }
  );
}

/** Log the internal cause while exposing only a correlation id to clients. */
export function internalApiError(
  log: LoggerInterface,
  error: unknown,
  message = "Internal server error"
) {
  const requestId = randomUUID();
  log.error("Internal API error", { requestId, error });
  return apiError("INTERNAL_ERROR", message, 500, requestId);
}

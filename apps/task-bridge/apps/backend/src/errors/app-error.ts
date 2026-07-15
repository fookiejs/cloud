export type BlockedSubtaskSummary = {
  id: number;
  title: string;
  stageId: string | null;
};

export type AppErrorDetails =
  | { code: string }
  | { subtasks: BlockedSubtaskSummary[] }
  | null;

export class AppError extends Error {
  readonly statusCode: number;
  readonly details: AppErrorDetails;

  constructor(message: string, statusCode: number, details: AppErrorDetails = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

type HandledError =
  | AppError
  | Error
  | { statusCode: string | number | boolean | null }
  | string
  | number
  | boolean
  | null;

export type { HandledError };

export function isAppError(error: HandledError): error is AppError {
  return error instanceof AppError;
}

export function statusCodeFromError(error: HandledError): number {
  if (isAppError(error)) return error.statusCode;
  if (error instanceof Object && "statusCode" in error) {
    const code = Number(error.statusCode);
    if (Number.isFinite(code)) {
      return code;
    }
  }
  return 500;
}

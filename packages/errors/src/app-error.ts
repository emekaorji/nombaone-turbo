import type { ApiFieldErrors, NombaoneErrorCode, HttpErrorStatusCode } from './codes';
import { HTTP_STATUS_CODES, getDefaultNombaoneErrorCodeForStatus } from './codes';

export class AppError extends Error {
  public readonly status: HttpErrorStatusCode;
  public readonly code: NombaoneErrorCode;
  public readonly details?: any;
  public readonly fieldErrors?: ApiFieldErrors;

  constructor(
    message: string,
    status: HttpErrorStatusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = this.normalizeErrorStatus(status);
    this.details = details;
    this.code = this.normalizeErrorCode(this.status, code);
    this.fieldErrors = fieldErrors;

    const errorWithCaptureStackTrace = Error as ErrorConstructor & {
      captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
    };

    errorWithCaptureStackTrace.captureStackTrace?.(this, this.constructor);
  }

  private normalizeErrorStatus(status: HttpErrorStatusCode): HttpErrorStatusCode {
    return Object.values(HTTP_STATUS_CODES).includes(status)
      ? status
      : HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  }

  private normalizeErrorCode(status: HttpErrorStatusCode, code?: NombaoneErrorCode): NombaoneErrorCode {
    if (code) {
      return code;
    }

    return getDefaultNombaoneErrorCodeForStatus(status);
  }

  static BadRequest(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.BAD_REQUEST, details, code, fieldErrors);
  }

  static Unauthorized(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.UNAUTHORIZED, details, code, fieldErrors);
  }

  static Forbidden(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.FORBIDDEN, details, code, fieldErrors);
  }

  static NotFound(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.NOT_FOUND, details, code, fieldErrors);
  }

  static Conflict(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.CONFLICT, details, code, fieldErrors);
  }

  static UnprocessableEntity(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(
      message,
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
      details,
      code,
      fieldErrors
    );
  }

  static TooManyRequests(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.TOO_MANY_REQUESTS, details, code, fieldErrors);
  }

  static InternalServerError(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(
      message,
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      details,
      code,
      fieldErrors
    );
  }

  static ThirdPartyServiceError(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.BAD_GATEWAY, details, code, fieldErrors);
  }

  static ServiceUnavailable(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, details, code, fieldErrors);
  }

  static GatewayTimeout(
    message: string,
    details?: any,
    code?: NombaoneErrorCode,
    fieldErrors?: ApiFieldErrors
  ) {
    return new AppError(message, HTTP_STATUS_CODES.GATEWAY_TIMEOUT, details, code, fieldErrors);
  }
}

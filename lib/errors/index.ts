// Centralized error handling system for PromptSwap

import { ErrorCodes } from '@/lib/api/responses';

// Error categories for different handling strategies
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',           // Input validation errors
  AUTH = 'AUTH',                       // Authentication/authorization errors  
  BUSINESS = 'BUSINESS',               // Business logic errors
  RESOURCE = 'RESOURCE',               // Resource not found/already exists
  EXTERNAL = 'EXTERNAL',               // External service errors (Stripe, etc.)
  UNEXPECTED = 'UNEXPECTED',           // Unexpected/system errors
}

// HTTP status code mappings
export const ErrorStatusMap: Record<ErrorCategory, number> = {
  [ErrorCategory.VALIDATION]: 400,
  [ErrorCategory.AUTH]: 401,
  [ErrorCategory.BUSINESS]: 409,
  [ErrorCategory.RESOURCE]: 404,
  [ErrorCategory.EXTERNAL]: 502,
  [ErrorCategory.UNEXPECTED]: 500,
};

// Base error class
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    category: ErrorCategory,
    code: string,
    message: string,
    details?: any,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.code = code;
    this.statusCode = statusCode ?? ErrorStatusMap[category];
    this.details = details;
    this.isOperational = true; // True for expected/operational errors

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(ErrorCategory.VALIDATION, code, message, details);
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(ErrorCategory.AUTH, code, message, details);
  }
}

export class BusinessError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(ErrorCategory.BUSINESS, code, message, details);
  }
}

export class ResourceError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(ErrorCategory.RESOURCE, code, message, details);
  }
}

export class ExternalError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(ErrorCategory.EXTERNAL, code, message, details);
  }
}

export class UnexpectedError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCategory.UNEXPECTED, ErrorCodes.INTERNAL_ERROR, message, details);
  }
}

// Error factory functions
export const Errors = {
  // Validation errors
  invalidInput: (message: string, details?: any) => 
    new ValidationError(ErrorCodes.VALIDATION_ERROR, message, details),
  
  invalidJson: (message: string = 'Invalid JSON in request body') =>
    new ValidationError(ErrorCodes.INVALID_JSON, message),
  
  // Auth errors
  unauthorized: (message: string = 'Authentication required') =>
    new AuthError(ErrorCodes.AUTH_REQUIRED, message),
  
  forbidden: (message: string = 'Insufficient permissions') =>
    new AuthError(ErrorCodes.FORBIDDEN, message),
  
  // Business logic errors
  insufficientFunds: (message: string = 'Insufficient funds') =>
    new BusinessError(ErrorCodes.INSUFFICIENT_FUNDS, message),
  
  promptNotPurchased: (message: string = 'Prompt not purchased') =>
    new BusinessError(ErrorCodes.PROMPT_NOT_PURCHASED, message),
  
  duplicateResource: (resource: string) =>
    new BusinessError(ErrorCodes.ALREADY_EXISTS, `${resource} already exists`),
  
  // Resource errors
  notFound: (resource: string) =>
    new ResourceError(ErrorCodes.NOT_FOUND, `${resource} not found`),
  
  // External service errors
  stripeError: (message: string, details?: any) =>
    new ExternalError(ErrorCodes.STRIPE_ERROR, message, details),
  
  databaseError: (message: string, details?: any) =>
    new ExternalError(ErrorCodes.DATABASE_ERROR, message, details),
  
  // Unexpected errors
  unexpected: (message: string, error?: any) =>
    new UnexpectedError(message, error),
};

// Helper to determine if error is operational (expected) vs unexpected
export function isOperationalError(error: any): error is AppError {
  return error instanceof AppError && error.isOperational;
}

// Helper to convert unknown error to AppError
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new UnexpectedError(error.message, {
      originalError: error.name,
      stack: error.stack,
    });
  }
  
  return new UnexpectedError('An unknown error occurred', { originalError: error });
}

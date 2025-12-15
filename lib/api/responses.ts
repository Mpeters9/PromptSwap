// Standardized API response types and helpers

export interface SuccessResponse<T = any> {
  ok: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;


// Common error codes
export const ErrorCodes = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Authentication/Authorization errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Business logic errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PROMPT_NOT_PURCHASED: 'PROMPT_NOT_PURCHASED',
  STRIPE_ERROR: 'STRIPE_ERROR',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // API specific errors
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_ACTION: 'INVALID_ACTION',
  SWAP_NOT_FOUND: 'SWAP_NOT_FOUND',
  INVALID_STATUS: 'INVALID_STATUS',
  COPY_FAILED: 'COPY_FAILED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Helper function to create success responses
export function createSuccessResponse<T = any>(data: T, message?: string): SuccessResponse<T> {
  return {
    ok: true,
    data,
    message,
  };
}

// Helper function to create error responses
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any
): ErrorResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// Validation error response
export function createValidationErrorResponse(errors: any[]): ErrorResponse {
  return createErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    'Input validation failed',
    { errors }
  );
}

// Authentication error response
export function createAuthErrorResponse(message: string = 'Authentication required'): ErrorResponse {
  return createErrorResponse(ErrorCodes.AUTH_REQUIRED, message);
}

// Not found error response
export function createNotFoundErrorResponse(resource: string): ErrorResponse {
  return createErrorResponse(ErrorCodes.NOT_FOUND, `${resource} not found`);
}

// Forbidden error response
export function createForbiddenErrorResponse(message: string = 'Insufficient permissions'): ErrorResponse {
  return createErrorResponse(ErrorCodes.FORBIDDEN, message);
}

// Server error response
export function createServerErrorResponse(error?: any): ErrorResponse {
  console.error('Server error:', error);
  return createErrorResponse(
    ErrorCodes.INTERNAL_ERROR,
    'An internal server error occurred',
    process.env.NODE_ENV === 'development' ? error : undefined
  );
}

// Type guard to check if response is an error
export function isErrorResponse<T>(response: ApiResponse<T>): response is ErrorResponse {
  return !response.ok;
}

// Type guard to check if response is a success
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.ok;
}

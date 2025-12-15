// Unified API handler combining error handling, logging, and responses

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, withRequestContext } from '@/lib/middleware/request-context';
import { businessLogger, logger } from '@/lib/logging';

import { 
  ApiResponse, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  isErrorResponse,
  type ErrorCode 
} from '@/lib/api/responses';
import { 
  AppError, 
  isOperationalError, 
  toAppError, 
  ErrorCategory,
  ErrorStatusMap 
} from '@/lib/errors';
import { z } from 'zod';

// Unified handler type
export type ApiHandler = (
  request: NextRequest,
  context: { params: Promise<{ [key: string]: string }> }
) => Promise<NextResponse<ApiResponse>>;


// Base API handler with request/response handling
export function createApiHandler(
  handler: ApiHandler,
  options?: {
    requireAuth?: boolean;
    logBusinessEvents?: boolean;
    skipValidation?: boolean;
  }
) {
  return withErrorHandling(async (request, context) => {
    const startTime = Date.now();
    const requestId = Date.now().toString();
    
    try {
      // Log incoming request
      logger.info('API request received', {
        path: request.nextUrl.pathname,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for'),
      }, 'API_REQUEST_START');
      
      // Call the actual handler
      const response = await handler(request, context);
      
      // Log successful response
      const duration = Date.now() - startTime;
      logger.info('API request completed', {
        status: response.status,
        duration,
        path: request.nextUrl.pathname,
      }, 'API_REQUEST_SUCCESS');
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log the error with context
      logger.error('API request failed', {
        duration,
        path: request.nextUrl.pathname,
        method: request.method,
      }, error as Error, 'API_REQUEST_ERROR');
      
      // Convert error and return appropriate response
      return handleErrorResponse(error, request);
    }
  });
}

// Handle error conversion and response formatting
function handleErrorResponse(error: unknown, request: NextRequest): NextResponse<ApiResponse> {
  // Convert to AppError
  const appError = toAppError(error);
  
  // Get appropriate status code
  const statusCode = appError.statusCode || ErrorStatusMap[appError.category] || 500;
  
  // Create client-safe error response
  let errorResponse: ApiResponse;
  
  if (isOperationalError(appError)) {
    // For operational errors, include details but sanitize them
    errorResponse = createErrorResponse(
      appError.code,
      appError.message,
      process.env.NODE_ENV === 'development' ? appError.details : undefined
    );
  } else {
    // For unexpected errors, return generic message to client
    errorResponse = createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
  
  return NextResponse.json(errorResponse, { status: statusCode });
}

// Create validated API handler
export function createValidatedApiHandler<R>(
  handler: (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }, validatedData: R) => Promise<NextResponse<ApiResponse>>,
  schema: z.ZodSchema<R>
): ApiHandler {
  return withRequestContext(async (request, context) => {
    // Parse and validate request body
    let validatedData: R;
    
    try {
      const body = await request.json();
      validatedData = schema.parse(body);
      
      logger.info('Request validated successfully', {
        path: request.nextUrl.pathname,
        method: request.method,
      }, 'VALIDATION_SUCCESS');
      

    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        logger.warn('Request validation failed', {
          path: request.nextUrl.pathname,
          errors: (validationError as any).errors,
        }, 'VALIDATION_FAILED');
        
        const errorResponse = createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid request data',
          { errors: (validationError as any).errors }
        );
        
        return NextResponse.json(errorResponse, { status: 400 });
      }
      
      // Re-throw other errors to be handled by error handling wrapper
      throw validationError;
    }
    
    // Call handler with validated data
    return handler(request, context, validatedData);
  });
}


// Business event logging helper
export class BusinessEventLogger {
  static async logPurchaseEvent(
    event: 'created' | 'completed' | 'failed',
    data: {
      promptId: string;
      userId: string;
      amount: number;
      stripeSessionId?: string;
      error?: string;
    }
  ) {
    switch (event) {
      case 'created':
        businessLogger.purchaseCreated({
          promptId: data.promptId,
          userId: data.userId,
          amount: data.amount,
          stripeSessionId: data.stripeSessionId
        });
        break;
      case 'completed':
        businessLogger.purchaseCompleted({
          promptId: data.promptId,
          userId: data.userId,
          stripeSessionId: data.stripeSessionId || ''
        });
        break;
      case 'failed':
        businessLogger.purchaseFailed({
          promptId: data.promptId,
          userId: data.userId,
          error: data.error || 'Unknown error'
        });
        break;
    }
  }
  
  static async logSwapEvent(
    event: 'requested' | 'state_changed' | 'completed' | 'failed',
    data: any
  ) {
    switch (event) {
      case 'requested':
        businessLogger.swapRequested(data);
        break;
      case 'state_changed':
        businessLogger.swapStateChanged(data);
        break;
      case 'completed':
        businessLogger.swapCompleted(data);
        break;
      case 'failed':
        businessLogger.swapFailed(data);
        break;
    }
  }
  
  static async logModerationEvent(
    action: 'approve' | 'reject' | 'ban',
    data: {
      promptId?: string;
      userId: string;
      moderatorId: string;
      reason?: string;
    }
  ) {
    switch (action) {
      case 'approve':
      case 'reject':
        if (data.promptId) {
          businessLogger.promptModerated({
            promptId: data.promptId,
            moderatorId: data.moderatorId,
            action,
            reason: data.reason,
          });
        }
        break;
      case 'ban':
        businessLogger.userBanned({
          userId: data.userId,
          moderatorId: data.moderatorId,
          reason: data.reason,
        });
        break;
    }
  }
  
  static async logStripeWebhook(
    type: string,
    id: string,
    result: 'success' | 'failed',
    accountId?: string
  ) {
    businessLogger.webhookReceived({ type, id, accountId });
    businessLogger.webhookProcessed({ type, id, result });
  }
}

// Helper to extract user info from request
export function extractUserInfo(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const userId = authHeader ? 'authenticated-user' : undefined; // Simplified
  return { userId };
}

// Standard response helpers
export const Responses = {
  success: <T>(data: T, message?: string) => 
    NextResponse.json(createSuccessResponse(data, message)),
  
  notFound: (resource: string) =>
    NextResponse.json(createErrorResponse(ErrorCodes.NOT_FOUND, `${resource} not found`), { status: 404 }),
  
  forbidden: (message?: string) =>
    NextResponse.json(createErrorResponse(ErrorCodes.FORBIDDEN, message || 'Forbidden'), { status: 403 }),
  
  unauthorized: (message?: string) =>
    NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, message || 'Unauthorized'), { status: 401 }),
  
  validationError: (errors: any[]) =>
    NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation failed', { errors }), { status: 400 }),
  
  internalError: (error?: any) =>
    NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error'), { status: 500 }),
};


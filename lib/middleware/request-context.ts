// Request context middleware for Next.js App Router

import { NextRequest } from 'next/server';
import { RequestContext, setRequestContext, clearRequestContext, generateCorrelationId } from '@/lib/logging';

// Extract request metadata
function extractRequestMetadata(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  
  // Extract user ID from auth header or cookie (if available)
  const authHeader = request.headers.get('authorization');
  const userId = authHeader ? 'authenticated' : undefined; // Simplified for demo
  
  return { userAgent, ip, userId };
}

// Create request context from Next.js request
export function createRequestContext(request: NextRequest): RequestContext {
  const requestId = generateCorrelationId();
  const correlationId = generateCorrelationId();
  const { userAgent, ip, userId } = extractRequestMetadata(request);
  
  return {
    requestId,
    correlationId,
    userId,
    path: request.nextUrl.pathname,
    method: request.method,
    timestamp: new Date().toISOString(),
    userAgent,
    ip,
  };
}

// Middleware wrapper for Next.js route handlers
export function withRequestContext<R>(
  handler: (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => Promise<R>
) {
  return async (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }): Promise<R> => {
    const requestContext = createRequestContext(request);
    
    try {
      // Set request context for the duration of this request
      setRequestContext(requestContext);
      
      // Call the original handler
      const result = await handler(request, context);
      
      return result;
    } finally {
      // Always clean up request context
      clearRequestContext(requestContext.requestId);
    }
  };
}

// Context-aware error wrapper
export function withErrorHandling<R>(
  handler: (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => Promise<R>
) {
  return withRequestContext(async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Import here to avoid circular dependencies
      const { toAppError, isOperationalError } = await import('@/lib/errors');
      const { logger } = await import('@/lib/logging');
      
      // Convert to AppError
      const appError = toAppError(error);
      
      // Log the error
      logger.error('Request failed', 
        { path: request.nextUrl.pathname, method: request.method },
        appError,
        'REQUEST_ERROR'
      );
      
      // Re-throw operational errors as-is
      if (isOperationalError(appError)) {
        throw appError;
      }
      
      // For unexpected errors, create a generic message for client
      const genericError = new Error('An unexpected error occurred');
      (genericError as any).statusCode = 500;
      throw genericError;
    }
  });
}


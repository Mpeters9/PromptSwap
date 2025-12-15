// Structured logging system for PromptSwap

import { randomUUID } from 'crypto';

// Request context for correlation and tracing
export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  path: string;
  method: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Log entry structure
export interface LogEntry {
  level: LogLevel;
  message: string;
  context: RequestContext;
  event?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    category?: string;
    code?: string;
  };
  timestamp: string;
  duration?: number;
}

// Environment configuration
const isProd = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Redaction rules for sensitive data
const REDACTED_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'card',
  'cvv',
  'ssn',
  'email',
]);

function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }
  
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// Request context management
const requestContextMap = new Map<string, RequestContext>();

export function setRequestContext(context: RequestContext) {
  requestContextMap.set(context.requestId, context);
}

export function getRequestContext(requestId: string): RequestContext | undefined {
  return requestContextMap.get(requestId);
}

export function clearRequestContext(requestId: string) {
  requestContextMap.delete(requestId);
}

// Generate correlation ID for request chaining
export function generateCorrelationId(): string {
  return randomUUID();
}

// Core logger class
class Logger {

  protected formatLogEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, any>,
    error?: Error,
    event?: string
  ): LogEntry {
    // Get current request context
    const context = this.getCurrentContext();
    
    return {
      level,
      message,
      context,
      event,
      data: data ? redactSensitiveData(data) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: isDevelopment ? error.stack : undefined, // Only include stack in dev
      } : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  private getCurrentContext(): RequestContext {
    // In a real implementation, this would extract from AsyncLocalStorage
    // For now, we'll use a default context
    return {
      requestId: 'unknown',
      correlationId: 'unknown',
      path: 'unknown',
      method: 'GET',
      timestamp: new Date().toISOString(),
    };
  }


  protected writeLog(entry: LogEntry) {
    if (isDevelopment) {
      // Verbose logging in development
      const formatted = this.formatForDevelopment(entry);
      console.log(formatted);
    } else {
      // Minimal, structured logging in production
      const formatted = JSON.stringify({
        level: entry.level,
        message: entry.message,
        requestId: entry.context.requestId,
        correlationId: entry.context.correlationId,
        event: entry.event,
        ...entry.data && { data: entry.data },
        ...entry.error && { error: { name: entry.error.name, message: entry.error.message } },
        timestamp: entry.timestamp,
      });
      
      if (entry.level === LogLevel.ERROR) {
        console.error(formatted);
      } else if (entry.level === LogLevel.WARN) {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  private formatForDevelopment(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const context = `[${entry.context.method} ${entry.context.path}]`;
    const requestInfo = `[${entry.context.requestId.substring(0, 8)}]`;
    
    let formatted = `${timestamp} ${entry.level.toUpperCase()} ${context} ${requestInfo} ${entry.message}`;
    
    if (entry.event) {
      formatted += ` [${entry.event}]`;
    }
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      formatted += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.error) {
      formatted += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        formatted += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    return formatted;
  }

  // Public logging methods
  error(message: string, data?: Record<string, any>, error?: Error, event?: string) {
    this.writeLog(this.formatLogEntry(LogLevel.ERROR, message, data, error, event));
  }

  warn(message: string, data?: Record<string, any>, event?: string) {
    this.writeLog(this.formatLogEntry(LogLevel.WARN, message, data, undefined, event));
  }

  info(message: string, data?: Record<string, any>, event?: string) {
    this.writeLog(this.formatLogEntry(LogLevel.INFO, message, data, undefined, event));
  }

  debug(message: string, data?: Record<string, any>, event?: string) {
    if (isDevelopment) {
      this.writeLog(this.formatLogEntry(LogLevel.DEBUG, message, data, undefined, event));
    }
  }
}

// Business event logging helpers
export class BusinessLogger extends Logger {
  // Purchase events
  purchaseCreated(data: { promptId: string; userId: string; amount: number; stripeSessionId?: string }) {
    this.info('Purchase created', data, 'PURCHASE_CREATED');
  }

  purchaseCompleted(data: { promptId: string; userId: string; stripeSessionId: string }) {
    this.info('Purchase completed', data, 'PURCHASE_COMPLETED');
  }

  purchaseFailed(data: { promptId: string; userId: string; error: string }) {
    this.error('Purchase failed', data, undefined, 'PURCHASE_FAILED');
  }

  // Swap events
  swapRequested(data: { requesterId: string; responderId: string; requestedPromptId: string; offeredPromptId: string }) {
    this.info('Swap requested', data, 'SWAP_REQUESTED');
  }

  swapStateChanged(data: { swapId: string; fromStatus: string; toStatus: string; userId: string }) {
    this.info('Swap state changed', data, 'SWAP_STATE_CHANGED');
  }

  swapCompleted(data: { swapId: string; requesterId: string; responderId: string }) {
    this.info('Swap completed', data, 'SWAP_COMPLETED');
  }

  swapFailed(data: { swapId: string; error: string }) {
    this.error('Swap failed', data, undefined, 'SWAP_FAILED');
  }

  // Moderation events
  promptModerated(data: { promptId: string; moderatorId: string; action: 'approve' | 'reject'; reason?: string }) {
    this.info('Prompt moderated', data, 'PROMPT_MODERATED');
  }

  userBanned(data: { userId: string; moderatorId: string; reason?: string }) {
    this.warn('User banned', data, 'USER_BANNED');
  }

  // Stripe webhook events
  webhookReceived(data: { type: string; id: string; accountId?: string }) {
    this.info('Stripe webhook received', data, 'WEBHOOK_RECEIVED');
  }

  webhookProcessed(data: { type: string; id: string; result: 'success' | 'failed' }) {
    this.info('Stripe webhook processed', data, 'WEBHOOK_PROCESSED');
  }

  // Authentication events
  loginAttempt(data: { userId?: string; email?: string; success: boolean }) {
    if (data.success) {
      this.info('User logged in', data, 'LOGIN_SUCCESS');
    } else {
      this.warn('Login failed', data, 'LOGIN_FAILED');
    }
  }

  // API route events
  apiRequest(data: { path: string; method: string; statusCode: number; duration?: number }) {
    const level = data.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.writeLog(this.formatLogEntry(level, 'API request', data, undefined, 'API_REQUEST'));
  }
}

// Export singleton instances
export const logger = new Logger();
export const businessLogger = new BusinessLogger();

// Middleware helper for request logging
export function createRequestLogger() {
  return {
    before: (requestId: string, path: string, method: string) => {
      const startTime = Date.now();
      
      return {
        after: (statusCode: number, data?: Record<string, any>) => {
          const duration = Date.now() - startTime;
          logger.info('Request completed', {
            path,
            method,
            statusCode,
            duration,
            ...data,
          }, 'HTTP_REQUEST');
        },
        error: (error: Error, data?: Record<string, any>) => {
          const duration = Date.now() - startTime;
          logger.error('Request failed', {
            path,
            method,
            duration,
            ...data,
          }, error, 'HTTP_REQUEST_ERROR');
        },
      };
    },
  };
}

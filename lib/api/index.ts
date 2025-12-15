// Shared API types and helpers for client-side use

// Re-export response types for client use
export type {
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from './responses';

export {
  createSuccessResponse,
  createErrorResponse,
  isErrorResponse,
  isSuccessResponse,
  ErrorCodes,
  createValidationErrorResponse,
  createAuthErrorResponse,
  createNotFoundErrorResponse,
  createForbiddenErrorResponse,
  createServerErrorResponse,
} from './responses';


// Re-export validation schemas for client-side validation
export {
  createPromptSchema,
  ratePromptSchema,
  commentSchema,
  purchaseSchema,
  createSwapSchema,
  updateSwapStatusSchema,
  moderatePromptSchema,
  banUserSchema,
  enableCreatorSchema,
  createCheckoutSessionSchema,
  connectStripeSchema,
  AllValidationSchemas,
  type ValidationSchemaKey,
} from '@/lib/validation/schemas';

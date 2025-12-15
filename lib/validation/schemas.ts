import { z } from 'zod';

// Prompt validation schemas
export const createPromptSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  prompt_text: z.string().min(1, 'Prompt text is required').max(10000, 'Prompt text too long'),
  price: z.number().min(0, 'Price must be non-negative').max(999.99, 'Price too high'),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  is_public: z.boolean().optional().default(true),
  version: z.number().optional().default(1),
});

export const ratePromptSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(500, 'Comment too long').optional().nullable(),
});

// Comment validation schema
export const commentSchema = z.object({
  comment: z.string().min(1, 'Comment is required').max(1000, 'Comment too long'),
  parent_id: z.string().uuid().optional().nullable(),
});

// Purchase validation schema
export const purchaseSchema = z.object({
  prompt_id: z.string().uuid('Invalid prompt ID'),
  payment_method_id: z.string().optional(),
});


// Swap validation schemas
export const createSwapSchema = z.object({
  requested_prompt_id: z.string().uuid('Invalid requested prompt ID'),
  offered_prompt_id: z.string().uuid('Invalid offered prompt ID'),
  responder_id: z.string().uuid('Invalid responder ID'),
});



export const updateSwapStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

// Admin moderation validation schemas
export const moderatePromptSchema = z.object({
  action: z.enum(['approve', 'reject']),
  prompt_id: z.string().uuid('Invalid prompt ID'),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const banUserSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  reason: z.string().max(500, 'Reason too long').optional(),
});

// Combined admin moderation schema
export const adminModerationSchema = z.object({
  type: z.enum(['moderatePrompt', 'banUser']),
  data: z.union([
    moderatePromptSchema,
    banUserSchema
  ])
});

// Swap action schema for swap updates
export const swapActionSchema = z.object({
  action: z.enum(['accept', 'reject']),
  swap_id: z.string().uuid('Invalid swap ID'),
});

// Creator enable validation schema
export const enableCreatorSchema = z.object({
  stripe_account_id: z.string().min(1, 'Stripe account ID is required'),
});

// Stripe validation schemas

export const createCheckoutSessionSchema = z.object({
  prompt_id: z.string().uuid('Invalid prompt ID'),
  title: z.string().min(1, 'Title is required'),
  price: z.number().positive('Price must be positive'), // in cents
  success_url: z.string().url('Invalid success URL').optional(),
  cancel_url: z.string().url('Invalid cancel URL').optional(),
});

export const connectStripeSchema = z.object({
  email: z.string().email('Invalid email address'),
  country: z.string().length(2, 'Country must be 2 characters').toUpperCase(),
});

// Refund request validation schema
export const refundRequestSchema = z.object({
  purchase_id: z.string().uuid('Invalid purchase ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason cannot exceed 500 characters'),
  requested_amount: z.number().positive('Requested amount must be positive').optional(),
});

// Admin refund management validation schema
export const adminRefundActionSchema = z.object({
  refund_request_id: z.string().uuid('Invalid refund request ID'),
  action: z.enum(['approve', 'reject', 'partial']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500, 'Reason cannot exceed 500 characters'),
  partial_amount: z.number().positive('Partial amount must be positive').optional(),
});

// Export all schemas as a union type for dynamic validation
export const AllValidationSchemas = {
  createPrompt: createPromptSchema,
  ratePrompt: ratePromptSchema,
  comment: commentSchema,
  purchase: purchaseSchema,
  createSwap: createSwapSchema,
  updateSwapStatus: updateSwapStatusSchema,
  moderatePrompt: moderatePromptSchema,
  banUser: banUserSchema,
  enableCreator: enableCreatorSchema,
  createCheckoutSession: createCheckoutSessionSchema,
  connectStripe: connectStripeSchema,
} as const;

export type ValidationSchemaKey = keyof typeof AllValidationSchemas;

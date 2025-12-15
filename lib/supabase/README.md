# Supabase Integration Patterns

This document outlines the standardized patterns for Supabase integration in PromptSwap, including validation, error handling, and API response formats.

## 🏗️ Architecture Overview

PromptSwap uses a clean separation between client-side and server-side Supabase operations:

- **Client Components**: Use `@/lib/supabase/client` for browser-based operations
- **Server Components/RSC**: Use `@/lib/supabase/server` for server-side rendering
- **API Routes**: Use `@/lib/supabase/server` for server-only operations
- **Middleware**: Use `@/lib/supabase/server` with proper context handling

## 📁 Import Paths

### ✅ Recommended (Standardized)

```typescript
// Client-side operations
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Server-side operations (RSC, API routes, Middleware)
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Authentication helpers
import { getCurrentUser } from '@/lib/supabase/server'
```

### ❌ Avoid (Legacy/Duplicate)

```typescript
// Don't use these import paths anymore
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@/lib/supabase'
import { supabaseClient } from '@/lib/supabase-client'
import { supabaseServerClient } from '@/lib/supabase-server'
```

## 🔐 Authentication Patterns

### Server-Side (Recommended)

```typescript
import { getCurrentUser } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json(
      createAuthErrorResponse(), 
      { status: 401 }
    )
  }
  
  // User is authenticated, proceed with business logic
}
```

### Client-Side

```typescript
'use client'

import { useUser } from '@/lib/useUser'

export function MyComponent() {
  const { user, loading } = useUser()
  
  if (loading) return <Loading />
  if (!user) return <LoginPrompt />
  
  // User is authenticated, show protected content
}
```

## 🛡️ Input Validation Pattern

All API routes must use Zod validation with the standardized error handling:

### 1. Define Schema

```typescript
// lib/validation/schemas.ts
import { z } from 'zod'

export const myActionSchema = z.object({
  prompt_id: z.string().uuid('Invalid prompt ID'),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(500, 'Comment too long').optional().nullable(),
})
```

### 2. Use in API Route

```typescript
// app/api/prompts/[id]/rate/route.ts
import { myActionSchema } from '@/lib/validation/schemas'
import { 
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createAuthErrorResponse,
  ErrorCodes
} from '@/lib/api/responses'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 })
    }

    // Parse request body
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid JSON in request body'
      ), { status: 400 })
    }

    // Validate input
    const validationResult = myActionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // Business logic with validated data
    // ...

    return NextResponse.json(createSuccessResponse({
      result: 'success'
    }, 'Action completed successfully'))

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(createServerErrorResponse(error))
  }
}
```

## 📋 API Response Standards

All API responses must follow the standardized format:

### Success Response

```typescript
{
  "ok": true,
  "data": {
    // Your response data here
  },
  "message": "Optional success message"
}
```

### Error Response

```typescript
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {
      // Optional additional error details
    }
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `UNAUTHORIZED` / `AUTH_REQUIRED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Unexpected server error

## 🗄️ Database Operations

### Server-Side (Recommended)

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getData() {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('table_name')
    .select('column1, column2')
    .eq('user_id', user.id)
  
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }
  
  return data
}
```

### Client-Side

```typescript
'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useData() {
  const supabase = createSupabaseBrowserClient()
  
  // Client-side operations only
  // Note: Avoid sensitive operations on client side
}
```

## 🔄 Migration Guide

### Step 1: Replace Import Statements

**Before:**
```typescript
import { createClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase-client'
```

**After:**
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server' // Server
import { createSupabaseBrowserClient } from '@/lib/supabase/client' // Client
```

### Step 2: Add Validation

Add Zod schemas for all API endpoints and validate input before processing.

### Step 3: Update Error Handling

Replace custom error handling with the standardized response helpers.

### Step 4: Test Thoroughly

Ensure all routes compile and function correctly with the new patterns.

## 🧪 Testing

### API Route Testing Pattern

```typescript
// Example test for API route
describe('/api/prompts/create', () => {
  it('should validate input and return success', async () => {
    const response = await fetch('/api/prompts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Valid Title',
        description: 'Valid Description',
        prompt_text: 'Valid prompt text',
        price: 9.99
      })
    })
    
    const data = await response.json()
    
    expect(data.ok).toBe(true)
    expect(data.data).toHaveProperty('promptId')
  })
  
  it('should return validation error for invalid input', async () => {
    const response = await fetch('/api/prompts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '', // Invalid: empty title
        description: 'Valid Description',
        prompt_text: 'Valid prompt text',
        price: 9.99
      })
    })
    
    const data = await response.json()
    
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(response.status).toBe(400)
  })
})
```

## 🔧 Troubleshooting

### Common Issues

1. **"Cannot resolve module" errors**
   - Ensure you're using the correct import paths
   - Check that the files exist in the expected locations

2. **Authentication not working**
   - Verify you're using `getCurrentUser()` from `@/lib/supabase/server`
   - Check middleware configuration

3. **Database errors**
   - Ensure RLS policies allow the operations
   - Verify the service role has proper permissions

4. **Validation errors**
   - Check that your Zod schemas match the actual API payloads
   - Ensure optional fields are properly marked as `.optional()`

### Getting Help

- Check the existing API routes for patterns
- Review the validation schemas in `/lib/validation/schemas.ts`
- Examine the response helpers in `/lib/api/responses.ts`

---

**Remember**: Consistency is key! All new API routes must follow these patterns, and existing routes should be migrated as time permits.


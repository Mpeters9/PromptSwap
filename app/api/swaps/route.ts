import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createSwapSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  ErrorCodes 
} from '@/lib/api/responses';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid JSON in request body'
      ), { status: 400 });
    }

    // Validate input using Zod schema
    const validationResult = createSwapSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { requested_prompt_id, offered_prompt_id, responder_id } = validationResult.data;

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Verify that the user doesn't already have a pending swap for these prompts
    const { data: existingSwap } = await supabase
      .from('swaps')
      .select('id')
      .eq('requester_id', user.id)
      .eq('requested_prompt_id', requested_prompt_id)
      .eq('offered_prompt_id', offered_prompt_id)
      .eq('responder_id', responder_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingSwap) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.ALREADY_EXISTS,
        'You already have a pending swap request for these prompts'
      ), { status: 400 });
    }

    // Verify that the prompts exist and are owned by the correct users
    const { data: requestedPrompt } = await supabase
      .from('prompts')
      .select('id, user_id')
      .eq('id', requested_prompt_id)
      .single();

    const { data: offeredPrompt } = await supabase
      .from('prompts')
      .select('id, user_id')
      .eq('id', offered_prompt_id)
      .single();

    if (!requestedPrompt || !offeredPrompt) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'One or both prompts do not exist'
      ), { status: 400 });
    }

    if (requestedPrompt.user_id !== user.id) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'You can only request your own prompts for swaps'
      ), { status: 400 });
    }

    if (offeredPrompt.user_id !== responder_id) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'The responder ID does not match the owner of the offered prompt'
      ), { status: 400 });
    }

    // Create the swap
    const { data: swap, error: insertError } = await supabase
      .from('swaps')
      .insert({
        id: crypto.randomUUID(),
        requester_id: user.id,
        responder_id,
        requested_prompt_id,
        offered_prompt_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating swap:', insertError);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create swap request'
      ), { status: 500 });
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      swapId: swap.id,
      status: 'pending'
    }, 'Swap request created successfully'));

  } catch (error) {
    console.error('Unexpected error in swap creation:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}

export async function GET(_req: Request) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
    }

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Get incoming and outgoing swaps
    const [incomingResult, outgoingResult] = await Promise.all([
      supabase
        .from('swaps')
        .select('id, requester_id, responder_id, requested_prompt_id, offered_prompt_id, status, created_at')
        .eq('responder_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('swaps')
        .select('id, requester_id, responder_id, requested_prompt_id, offered_prompt_id, status, created_at')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (incomingResult.error) {
      console.error('Error fetching incoming swaps:', incomingResult.error);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch incoming swaps'
      ), { status: 500 });
    }

    if (outgoingResult.error) {
      console.error('Error fetching outgoing swaps:', outgoingResult.error);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch outgoing swaps'
      ), { status: 500 });
    }

    // Get unique prompt IDs for batch loading
    const promptIds = [
      ...(incomingResult.data ?? []).flatMap((s) => [s.requested_prompt_id, s.offered_prompt_id]),
      ...(outgoingResult.data ?? []).flatMap((s) => [s.requested_prompt_id, s.offered_prompt_id]),
    ].filter(Boolean) as string[];

    const uniquePromptIds = Array.from(new Set(promptIds));
    const promptMap: Record<string, any> = {};

    if (uniquePromptIds.length > 0) {
      const { data: prompts, error: promptsError } = await supabase
        .from('prompts')
        .select('id, title, preview_image, price, user_id')
        .in('id', uniquePromptIds);

      if (promptsError) {
        console.error('Error fetching prompt details:', promptsError);
      } else {
        prompts?.forEach((p) => {
          promptMap[p.id] = p;
        });
      }
    }

    // Enrich swap data with prompt details
    const enrichSwaps = (swaps: any[]) =>
      swaps.map((s) => ({
        ...s,
        requested_prompt: promptMap[s.requested_prompt_id] ?? null,
        offered_prompt: promptMap[s.offered_prompt_id] ?? null,
      }));

    // Return success response
    return NextResponse.json(createSuccessResponse({
      incoming: enrichSwaps(incomingResult.data ?? []),
      outgoing: enrichSwaps(outgoingResult.data ?? []),
    }));

  } catch (error) {
    console.error('Unexpected error in swaps fetch:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}


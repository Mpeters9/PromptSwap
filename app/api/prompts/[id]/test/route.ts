import axios from 'axios';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Body = {
  apiKey?: string;
  model?: string;
  promptInput?: string;
};

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max requests per window per identifier
const rateLimitMap = new Map<string, number[]>();

function getClientIdentifier(req: NextRequest) {
  return (
    req.ip ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous'
  );
}

function checkRateLimit(identifier: string) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const history = (rateLimitMap.get(identifier) || []).filter((ts) => ts > windowStart);

  if (history.length >= RATE_LIMIT_MAX) {
    return false;
  }

  history.push(now);
  rateLimitMap.set(identifier, history);
  return true;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const identifier = getClientIdentifier(req);
  if (!checkRateLimit(identifier)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute and try again.' }, { status: 429 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  const model = body.model?.trim();
  const promptInput = body.promptInput ?? '';

  if (!apiKey || !model) {
    return NextResponse.json({ error: 'Missing required fields: apiKey and model are required.' }, { status: 400 });
  }

  try {
    const output = await runModelRequest({ model, apiKey, promptInput });
    return NextResponse.json({ output, model, promptId: params.id });
  } catch (err: any) {
    const message =
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.message ||
      'Failed to run test.';
    const status = err?.response?.status && Number.isInteger(err.response.status) ? err.response.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function runModelRequest({
  model,
  apiKey,
  promptInput,
: { model: string; apiKey: string; promptInput: string }) {
  // Route OpenAI vs Anthropic based on model naming.
  if (model.startsWith('claude')) {
    return runAnthropic({ model, apiKey, promptInput });
  }
  return runOpenAI({ model, apiKey, promptInput });
}

async function runOpenAI({ model, apiKey, promptInput }: { model: string; apiKey: string; promptInput: string }) {
  const isChat = model.includes('gpt');
  const url = isChat
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.openai.com/v1/completions';

  const payload = isChat
    ? {
        model,
        messages: [{ role: 'user', content: promptInput || 'Test the prompt with given input.' }],
        temperature: 0.7,
        max_tokens: 256,
      }
    : {
        model,
        prompt: promptInput || 'Test the prompt with given input.',
        temperature: 0.7,
        max_tokens: 256,
      };

  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (isChat) {
    return data?.choices?.[0]?.message?.content ?? null;
  }
  return data?.choices?.[0]?.text ?? null;
}

async function runAnthropic({
  model,
  apiKey,
  promptInput,
}: {
  model: string;
  apiKey: string;
  promptInput: string;
}) {
  const url = 'https://api.anthropic.com/v1/messages';
  const { data } = await axios.post(
    url,
    {
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: promptInput || 'Test the prompt with given input.' }],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    },
  );

  return data?.content?.[0]?.text ?? null;
}

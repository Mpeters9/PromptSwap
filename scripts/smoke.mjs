import { config } from 'dotenv';

config();

const requiredEnvs = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_CLIENT_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'OPENAI_API_KEY',
];

const missingEnvs = requiredEnvs.filter((name) => !process.env[name]);
if (missingEnvs.length) {
  console.error('Missing environment variables:', missingEnvs.join(', '));
  throw new Error('Smoke check failed: incomplete environment configuration');
}

const baseUrl = process.env.BASE_URL
  ? new URL(process.env.BASE_URL)
  : new URL('http://localhost:3000');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectOkResponse(response, context) {
  assert(response.status === 200, `${context}: expected HTTP 200, got ${response.status}`);
  const requestId = response.headers.get('x-request-id');
  assert(requestId, `${context}: missing x-request-id response header`);
  const body = await response.json().catch(() => null);
  assert(body && body.ok, `${context}: expected an { ok: true } response, got ${JSON.stringify(body)}`);
  return body;
}

async function checkHealth() {
  console.log(`Checking health endpoint at ${baseUrl}/api/health`);
  const response = await fetch(new URL('/api/health', baseUrl).toString(), {
    headers: { 'Cache-Control': 'no-cache' },
  });
  await expectOkResponse(response, '/api/health');
  console.log('Health check passed (x-request-id present)');
}

async function checkPromptSearch() {
  const searchUrl = new URL('/api/prompts/search', baseUrl);
  searchUrl.searchParams.set('q', 'test');
  searchUrl.searchParams.set('page', '1');
  searchUrl.searchParams.set('pageSize', '5');

  console.log(`Performing prompt search against ${searchUrl}`);
  const response = await fetch(searchUrl.toString(), { headers: { 'Cache-Control': 'no-cache' } });
  const body = await expectOkResponse(response, '/api/prompts/search');

  const data = body.data ?? {};
  assert(
    Array.isArray(data.items),
    `/api/prompts/search: expected data.items to be an array, got ${typeof data.items}`
  );
  assert(typeof data.page === 'number', '/api/prompts/search: expected numeric page');
  assert(typeof data.pageSize === 'number', '/api/prompts/search: expected numeric pageSize');
  assert(typeof data.total === 'number', '/api/prompts/search: expected numeric total');
  console.log(`Prompt search returned ${data.items.length} items`);
}

async function checkNotifications() {
  const token = process.env.SMOKE_AUTH_TOKEN;
  if (!token) {
    console.log('Skipping notifications check (SMOKE_AUTH_TOKEN not set)');
    return;
  }

  console.log('Checking notifications endpoint with provided token');
  const response = await fetch(new URL('/api/notifications', baseUrl).toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
  });
  const body = await expectOkResponse(response, '/api/notifications');

  assert(Array.isArray(body.data.notifications), '/api/notifications: expected notifications array');
  console.log(`Notifications endpoint returned ${body.data.notifications.length} records`);
}

async function main() {
  console.log('Running smoke checks...');
  await Promise.all([checkHealth(), checkPromptSearch(), checkNotifications()]);
  console.log('Smoke checks completed successfully');
}

main().catch((error) => {
  console.error('Smoke check failed:', error);
  process.exit(1);
});

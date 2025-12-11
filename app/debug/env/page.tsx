export default function EnvDebugPage() {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "missing",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
    NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
  };

  return (
    <main style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>Supabase env debug</h1>
      <p>This is what the server can see at runtime (keys themselves are never shown).</p>
      <pre>{JSON.stringify(vars, null, 2)}</pre>
    </main>
  );
}

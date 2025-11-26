import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const promptId = params.id;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY!
  );

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token)
    return NextResponse.json({ error: "Missing auth" }, { status: 401 });

  const { data: session } = await supabase.auth.getUser(token);

  if (!session?.user)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // Verify purchase
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("buyer_id", session.user.id)
    .eq("prompt_id", promptId)
    .single();

  if (!purchase)
    return NextResponse.json(
      { error: "You do not own this item" },
      { status: 403 }
    );

  // Fetch file from storage
  const { data: file } = await supabase.storage
    .from("prompts")
    .download(`${promptId}.txt`);

  if (!file)
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 }
    );

  return new NextResponse(file, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="prompt-${promptId}.txt"`,
    },
  });
}

import { supabaseBrowser } from "@/lib/supabase/browser";

export default async function LibraryPage() {
  const supabase = supabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto pt-20">
        <h1 className="text-3xl font-bold mb-6">Your Library</h1>
        <p className="text-slate-700">Please sign in to view purchased prompts.</p>
      </div>
    );
  }

  const { data: purchases } = await supabase
    .from("purchases")
    .select("prompt_id, prompts(*)")
    .eq("buyer_id", user.id);

  const purchaseList = (purchases ?? []) as any[];

  return (
    <div className="max-w-3xl mx-auto pt-20">
      <h1 className="text-3xl font-bold mb-6">Your Library</h1>

      <div className="grid gap-4">
        {purchaseList.map((p) => (
          <div key={p.prompt_id} className="border p-4 rounded">
            <h2 className="font-bold text-xl">{p.prompts?.title ?? "Prompt"}</h2>
            <p>{p.prompts?.content ?? ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

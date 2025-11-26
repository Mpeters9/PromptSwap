import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default async function LibraryPage() {
  const supabase = createClientComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("prompt_id, prompts(*)")
    .eq("buyer_id", user.id);

  return (
    <div className="max-w-3xl mx-auto pt-20">
      <h1 className="text-3xl font-bold mb-6">Your Library</h1>

      <div className="grid gap-4">
        {purchases?.map((p) => (
          <div key={p.prompt_id} className="border p-4 rounded">
            <h2 className="font-bold text-xl">{p.prompts.title}</h2>
            <p>{p.prompts.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

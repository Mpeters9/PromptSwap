"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabaseBrowser } from "@/lib/supabase/browser";

export default function PurchasesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = supabaseBrowser();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from("purchases")
        .select("id, created_at, amount, prompts(id, title, description)")
        .eq("buyer_id", session.user.id)
        .order("created_at", { ascending: false });

      setItems(data || []);
      setLoading(false);
    }

    load();
  }, []);

  if (loading)
    return <div className="p-10 text-center">Loading purchases...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Your Purchased Prompts</h1>

      {items.length === 0 && (
        <p className="text-gray-500">You haven't bought anything yet.</p>
      )}

      <div className="grid gap-4">
        {items.map((p) => (
          <div
            key={p.id}
            className="border p-4 rounded-lg bg-white shadow-sm"
          >
            <h2 className="font-semibold text-xl">
              {p.prompts?.title}
            </h2>
            <p className="text-gray-600 mt-1">
              {p.prompts?.description}
            </p>

            <div className="mt-4 flex gap-3">
              <Link
                href={`/prompt/${p.prompts?.id}`}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                View Prompt
              </Link>

              <a
                href={`/api/download/${p.prompts?.id}`}
                className="px-4 py-2 rounded bg-gray-800 text-white"
              >
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

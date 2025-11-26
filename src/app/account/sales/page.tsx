"use client";

import { useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = supabaseBrowser();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from("purchases")
        .select("amount, created_at, prompts(title)")
        .eq("seller_id", session.user.id)
        .order("created_at", { ascending: false });

      setSales(data || []);
      setTotal(
        data?.reduce((sum, sale) => sum + sale.amount, 0) || 0
      );
    }

    load();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Your Sales</h1>

      <p className="text-xl mb-6">
        Total Earnings: <strong>${total.toFixed(2)}</strong>
      </p>

      <div className="space-y-4">
        {sales.map((sale, i) => (
          <div key={i} className="border p-4 rounded-lg bg-white shadow">
            <h2 className="font-semibold">{sale.prompts.title}</h2>
            <p>${sale.amount.toFixed(2)}</p>
            <p className="text-gray-500 text-sm">
              {new Date(sale.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

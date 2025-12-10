"use client";
import { useState } from "react";

export default function PromptPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(false);

  async function startPurchase() {
    setLoading(true);
    try {
      await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        body: JSON.stringify({ promptId: params.id }),
      });
      alert("Purchase flow not available (Stripe client not configured).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="bg-blue-600 text-white px-4 py-2 rounded"
      onClick={startPurchase}
      disabled={loading}
    >
      Buy Prompt
    </button>
  );
}

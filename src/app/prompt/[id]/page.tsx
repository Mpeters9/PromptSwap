"use client";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function PromptPage({ params }) {
  const [loading, setLoading] = useState(false);

  async function startPurchase() {
    setLoading(true);

    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      body: JSON.stringify({ promptId: params.id }),
    });

    const { clientSecret } = await res.json();
    const stripe = await stripePromise;

    const result = await stripe!.redirectToCheckout({
      lineItems: [],
      mode: "payment",
      clientSecret,
    });

    if (result.error) alert(result.error.message);
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

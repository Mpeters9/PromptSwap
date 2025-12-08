"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type BuyButtonProps = {
  promptId: string;
  title: string;
  price: number;
  userId: string | null | undefined;
  isCreator: boolean;
  hasPurchased: boolean;
};

export default function BuyButton({
  promptId,
  title,
  price,
  userId,
  isCreator,
  hasPurchased,
}: BuyButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    if (!userId) {
      router.push("/signin");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({
        prompt_id: promptId,
        title,
        price,
        user_id: userId,
      }),
    });

    const { url } = await res.json();
    router.push(url);
  }

  // OWNER LOGIC
  if (isCreator) {
    return (
      <div className="rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
        You created this prompt
      </div>
    );
  }

  if (hasPurchased) {
    return (
      <div className="rounded-md bg-green-50 px-3 py-1.5 text-xs text-green-700">
        You own this prompt
      </div>
    );
  }

  return (
    <Button disabled={loading} onClick={handleBuy}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Buy for ${price.toFixed(2)}
    </Button>
  );
}

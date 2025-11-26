"use client";
import { useState } from "react";

export default function SellerPage() {
  const [loading, setLoading] = useState(false);

  async function startOnboarding() {
    setLoading(true);
    const res = await fetch("/api/stripe/connect/create-account", { method: "POST" });
    const data = await res.json();
    window.location.href = data.url;
  }

  async function openDashboard() {
    const res = await fetch("/api/stripe/connect/dashboard");
    const data = await res.json();
    window.location.href = data.url;
  }

  return (
    <div className="max-w-xl mx-auto pt-20 flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Seller Dashboard</h1>

      <button
        onClick={startOnboarding}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Become a Seller
      </button>

      <button
        onClick={openDashboard}
        className="bg-gray-700 text-white px-4 py-2 rounded"
      >
        Open Stripe Dashboard
      </button>
    </div>
  );
}

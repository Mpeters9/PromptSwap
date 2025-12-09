// components/TestModeBanner.tsx
import Link from "next/link";

export function TestModeBanner() {
  // This relies on NEXT_PUBLIC_IS_TEST_MODE being "1" in env.
  const isTestMode =
    process.env.NEXT_PUBLIC_IS_TEST_MODE === "1" ||
    process.env.NEXT_PUBLIC_IS_TEST_MODE === "true";

  if (!isTestMode) {
    return null;
  }

  return (
    <div className="flex items-center justify-center border-b border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
      <span className="font-medium mr-1">Test mode active.</span>
      <span className="hidden sm:inline">
        Payments are using Stripe test keys and AI responses may be mocked.
      </span>
      <span className="sm:ml-2">
        <Link
          href="/prompts"
          className="underline underline-offset-2 hover:text-yellow-800"
        >
          Browse prompts
        </Link>
      </span>
    </div>
  );
}

import Link from "next/link";

import NavbarClient from "@/components/navbar-client";
import { getCurrentUser } from "@/lib/supabase-server";

export default async function Navbar() {
  const user = await getCurrentUser();
  const initialUser = user
    ? {
        id: user.id,
        email: user.email ?? null,
      }
    : null;

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold">
          PromptSwap
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground transition sm:flex">
          <Link className="text-sm text-muted-foreground hover:text-foreground transition" href="/">
            Home
          </Link>
          <Link className="text-sm text-muted-foreground hover:text-foreground transition" href="/prompts">
            Marketplace
          </Link>
          <Link className="text-sm text-muted-foreground hover:text-foreground transition" href="/dashboard">
            Dashboard
          </Link>
        </nav>

        <NavbarClient initialUser={initialUser} />
      </div>
    </header>
  );
}

// app/purchases/page.tsx
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PurchasesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const purchases = await prisma.purchase.findMany({
    where: { buyerId: user.id },
    include: {
      prompt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Purchases</h1>
          <p className="text-sm text-muted-foreground">
            All prompts you’ve bought. Click any card to view the full prompt details.
          </p>
        </div>
      </div>

      {purchases.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No purchases yet</CardTitle>
            <CardDescription>
              When you buy a prompt, it will show up here so you can quickly get back to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/prompts">Browse prompts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {purchases.map((purchase) => {
            const prompt = purchase.prompt;
            if (!prompt) return null;

            const priceDisplay =
              prompt.price && Number(prompt.price) > 0
                ? `$${Number(prompt.price).toFixed(2)}`
                : "Free";

            return (
              <Link
                key={purchase.id}
                href={`/prompts/${prompt.id}`}
                className="group"
              >
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardHeader className="space-y-1">
                    <CardTitle className="line-clamp-2 text-base">
                      {prompt.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {prompt.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{priceDisplay}</Badge>
                      {Array.isArray(prompt.tags) &&
                        prompt.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Purchased{" "}
                      {purchase.createdAt
                        ? new Date(purchase.createdAt).toLocaleDateString()
                        : ""}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

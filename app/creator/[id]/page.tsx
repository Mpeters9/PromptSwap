import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PromptPreviewImage } from "@/components/PromptPreviewImage";
import { Card, CardContent } from "@/components/ui/card";

export default async function CreatorProfile({ params }: { params: { id: string } }) {
  const userId = params.id;

  const [creator, prompts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
    }),
    prisma.prompt.findMany({
      where: { userId, isPublic: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!creator) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">{creator.email}</h1>
      <p className="text-slate-600 mb-6">
        Prompts by this creator
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {prompts.map((p) => (
          <Link key={p.id} href={`/prompts/${p.id}`}>
            <Card className="hover:shadow-md transition-all">
              <PromptPreviewImage src={p.previewImage} alt={p.title} />
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2">{p.title}</h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}

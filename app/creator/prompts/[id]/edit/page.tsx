// app/creator/prompts/[id]/edit/page.tsx
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser, createSupabaseAdminClient } from "@/lib/supabase-server";
import { enforceRateLimit, RateLimitExceeded } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type EditPageProps = {
  params: { id: string };
};

export default async function EditPromptPage({ params }: EditPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const promptId = Number(params.id);
  if (!Number.isInteger(promptId)) {
    notFound();
  }

    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        promptText: true,
        tags: true,
        price: true,
        previewImage: true,
        isPublic: true,
        isFeatured: true,
        status: true,
        moderationNote: true,
      },
    });

  if (!prompt) {
    notFound();
  }

  if (prompt.userId !== user.id) {
    // Not the owner — redirect to view page or 404 for safety
    redirect(`/prompts/${prompt.id}`);
  }

  const editableStatuses = new Set(["draft", "submitted", "rejected"]);
  if (!editableStatuses.has(prompt.status)) {
    redirect(`/creator/prompts/${prompt.id}`);
  }

  async function updatePrompt(formData: FormData) {
    "use server";

    const userInner = await getCurrentUser();
    if (!userInner) {
      redirect("/auth/login");
    }

    const supabaseAdmin = await createSupabaseAdminClient();
    try {
      await enforceRateLimit({
        request: new Request("https://promptswap.rate-limit"),
        supabase: supabaseAdmin,
        scope: "prompt:update",
        limit: 10,
        windowSeconds: 60,
        userId: userInner.id,
      });
    } catch (err: any) {
      if (err instanceof RateLimitExceeded) {
        throw new Error("You are updating prompts too quickly; please wait a moment.");
      }
      throw err;
    }

    const promptId = Number((formData.get("prompt_id") ?? "").toString());
    if (!Number.isInteger(promptId)) {
      notFound();
    }
    const existing = await prisma.prompt.findUnique({
      where: { id: promptId },
    });

    if (!existing) {
      notFound();
    }

    if (existing.userId !== userInner.id) {
      redirect(`/prompts/${promptId}`);
    }

    const title = (formData.get("title") ?? "").toString().trim();
    const description = (formData.get("description") ?? "").toString().trim();
    const promptText = (formData.get("prompt_text") ?? "").toString();
    const tagsRaw = (formData.get("tags") ?? "").toString();
    const priceRaw = (formData.get("price") ?? "").toString();
    const previewImage = (formData.get("preview_image") ?? "").toString().trim();
    const isPublicRaw = formData.get("is_public");
    const isFeaturedRaw = formData.get("is_featured");

    if (!title || !promptText) {
      throw new Error("Title and prompt text are required.");
    }

    const tags =
      tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const price = priceRaw ? parseFloat(priceRaw) : 0;
    const isPublic = isPublicRaw === "on";
    const isFeatured = isFeaturedRaw === "on";
    const intent = (formData.get("intent") ?? "").toString();
    const nextStatus =
      intent === "draft"
        ? "draft"
        : intent === "submitted"
        ? "submitted"
        : existing.status;
    const moderationNote =
      intent === "submitted" ? null : existing.moderationNote;

    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        title,
        description: description || null,
        promptText,
        tags,
        price,
        previewImage: previewImage || null,
        isPublic,
        isFeatured,
        status: nextStatus,
        moderationNote,
      },
    });

    revalidatePath("/creator/prompts");
    revalidatePath("/prompts");
    revalidatePath(`/prompts/${promptId}`);
    redirect("/creator/prompts");
  }

  async function resubmitPrompt(formData: FormData) {
    "use server";

    const userInner = await getCurrentUser();
    if (!userInner) {
      redirect("/auth/login");
    }

    const promptId = Number((formData.get("prompt_id") ?? "").toString());
    if (!Number.isInteger(promptId)) {
      notFound();
    }

    const existing = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { id: true, userId: true, status: true },
    });

    if (!existing || existing.userId !== userInner.id || existing.status !== "rejected") {
      redirect(`/prompts/${promptId}`);
    }

    const supabaseAdmin = await createSupabaseAdminClient();
    try {
      await enforceRateLimit({
        request: new Request("https://promptswap.rate-limit"),
        supabase: supabaseAdmin,
        scope: "prompt:resubmit",
        limit: 3,
        windowSeconds: 60 * 30,
        userId: userInner.id,
      });
    } catch (err: any) {
      if (err instanceof RateLimitExceeded) {
        throw new Error("You're resubmitting too often; please wait before trying again.");
      }
      throw err;
    }

    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        status: "submitted",
        moderationNote: null,
      },
    });

    revalidatePath("/creator/prompts");
    revalidatePath("/prompts");
    revalidatePath(`/prompts/${promptId}`);
    redirect("/creator/prompts");
  }

  const tagsDisplay =
    Array.isArray(prompt.tags) && prompt.tags.length > 0
      ? prompt.tags.join(", ")
      : "";
  const statusClasses: Record<string, string> = {
    draft: "bg-slate-100 text-slate-800",
    submitted: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800",
    approved: "bg-emerald-100 text-emerald-800",
    archived: "bg-slate-900 text-white",
  };
  const statusClass = statusClasses[prompt.status] ?? "bg-slate-100 text-slate-800";
  const statusLabel = prompt.status.charAt(0).toUpperCase() + prompt.status.slice(1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit prompt</CardTitle>
          <CardDescription>
            Update the details of your prompt. Changes will be reflected in the marketplace.
          </CardDescription>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
              {statusLabel}
            </Badge>
            {prompt.moderationNote && (
              <p className="text-xs text-muted-foreground">Last note: {prompt.moderationNote}</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form action={updatePrompt} className="space-y-4">
            <input type="hidden" name="prompt_id" value={prompt.id} />

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={prompt.title ?? ""}
                placeholder="e.g. Viral Product Launch Script"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={prompt.description ?? ""}
                placeholder="What does this prompt do? Who is it for?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt_text">Prompt text</Label>
              <Textarea
                id="prompt_text"
                name="prompt_text"
                defaultValue={prompt.promptText ?? ""}
                placeholder="The full prompt that buyers will unlock..."
                rows={8}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={
                    prompt.price ? Number(prompt.price).toString() : "0"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  name="tags"
                  defaultValue={tagsDisplay}
                  placeholder="marketing, email, copywriting"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview_image">Preview image URL (optional)</Label>
              <Input
                id="preview_image"
                name="preview_image"
                defaultValue={prompt.previewImage ?? ""}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="is_public"
                name="is_public"
                type="checkbox"
                className="w-4"
                defaultChecked={!!prompt.isPublic}
              />
              <Label htmlFor="is_public" className="text-sm font-normal">
                Make this prompt public in the marketplace
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="is_featured"
                name="is_featured"
                type="checkbox"
                className="w-4"
                defaultChecked={!!prompt.isFeatured}
              />
              <Label htmlFor="is_featured" className="text-sm font-normal">
                Feature this prompt on the homepage (you can change this any time)
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" name="intent" value="draft">
                Save as draft
              </Button>
              <Button type="submit" name="intent" value="submitted">
                Submit for review
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {prompt.status === 'rejected' && (
        <form
          action={resubmitPrompt}
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-900"
        >
          <input type="hidden" name="prompt_id" value={prompt.id} />
          <p>
            This prompt was rejected. Make any necessary changes above, then resubmit it for review.
          </p>
          <div className="mt-3 flex justify-end">
            <Button type="submit">Resubmit for review</Button>
          </div>
        </form>
      )}
    </main>
  );
}

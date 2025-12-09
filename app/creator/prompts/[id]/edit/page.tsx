// app/creator/prompts/[id]/edit/page.tsx
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
    redirect("/signin");
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
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
    },
  });

  if (!prompt) {
    notFound();
  }

  if (prompt.userId !== user.id) {
    // Not the owner — redirect to view page or 404 for safety
    redirect(`/prompts/${prompt.id}`);
  }

  async function updatePrompt(formData: FormData) {
    "use server";

    const userInner = await getCurrentUser();
    if (!userInner) {
      redirect("/signin");
    }

    const promptId = (formData.get("prompt_id") ?? "").toString();
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
      },
    });

    // Optional: create a new version snapshot when editing
    await prisma.promptVersion.create({
      data: {
        promptId,
        userId: userInner.id,
        content: promptText,
        notes: "Edited prompt",
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit prompt</CardTitle>
          <CardDescription>
            Update the details of your prompt. Changes will be reflected in the marketplace.
          </CardDescription>
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
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

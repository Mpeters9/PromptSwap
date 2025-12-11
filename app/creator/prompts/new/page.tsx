// app/creator/prompts/new/page.tsx
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default async function NewPromptPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  async function createPrompt(formData: FormData) {
    "use server";

    const userInner = await getCurrentUser();
    if (!userInner) {
      redirect("/auth/login");
    }

    const title = (formData.get("title") ?? "").toString().trim();
    const description = (formData.get("description") ?? "").toString().trim();
    const promptText = (formData.get("prompt_text") ?? "").toString();
    const tagsRaw = (formData.get("tags") ?? "").toString();
    const priceRaw = (formData.get("price") ?? "").toString();
    const previewImage = (formData.get("preview_image") ?? "").toString().trim();
    const isPublicRaw = formData.get("is_public");

    if (!title || !promptText) {
      // In a real app you might add nicer validation feedback.
      throw new Error("Title and prompt text are required.");
    }

    const tags =
      tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const price = priceRaw ? parseFloat(priceRaw) : 0;
    const isPublic = isPublicRaw === "on";

    const prompt = await prisma.prompt.create({
      data: {
        userId: userInner.id,
        title,
        description: description || null,
        promptText,
        tags,
        price,
        previewImage: previewImage || null,
        isPublic,
      },
    });

    revalidatePath("/creator/prompts");
    revalidatePath("/prompts");
    redirect(`/creator/prompts`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a new prompt</CardTitle>
          <CardDescription>
            Define your prompt, price, and tags. You can edit these details later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPrompt} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="e.g. Viral Product Launch Script" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What does this prompt do? Who is it for?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt_text">Prompt text</Label>
              <Textarea
                id="prompt_text"
                name="prompt_text"
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
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  name="tags"
                  placeholder="marketing, email, copywriting"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview_image">Preview image URL (optional)</Label>
              <Input
                id="preview_image"
                name="preview_image"
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Input id="is_public" name="is_public" type="checkbox" className="w-4" />
              <Label htmlFor="is_public" className="text-sm font-normal">
                Make this prompt public in the marketplace
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit">Create prompt</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

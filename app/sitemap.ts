import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/prompts",
    "/pricing",
    "/faq",
    "/terms",
    "/privacy",
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));

  const prompts = await prisma.prompt.findMany({
    select: { id: true },
  });

  const promptRoutes: MetadataRoute.Sitemap = prompts.map((p) => ({
    url: `${siteUrl}/prompts/${p.id}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...promptRoutes];
}

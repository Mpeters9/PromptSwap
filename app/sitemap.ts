import type { MetadataRoute } from "next";

function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://promptswap.app";
  return raw.replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const routes = [
    "",
    "/prompts",
    "/marketplace",
    "/signin",
    "/auth/login",
    "/auth/signup",
    "/upload",
    "/dashboard",
  ];

  return routes.map((path) => ({
    url: siteUrl + path,
    lastModified: new Date(),
  }));
}

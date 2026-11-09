import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, publicSiteOrigin } from "@/lib/marketing/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  return PUBLIC_SITEMAP_PATHS.map(({ path, priority }) => ({
    url: `${origin}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}

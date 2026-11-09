import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/marketing/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/cliente", "/onboarding", "/auth", "/api", "/convite", "/conta-suspensa"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}

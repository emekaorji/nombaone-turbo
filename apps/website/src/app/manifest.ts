import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nomba One",
    short_name: "Nomba One",
    description:
      "Managed recurring billing for Nigeria — subscriptions, dunning, reconciliation, and settlement across every rail.",
    start_url: "/",
    display: "standalone",
    background_color: "#040404",
    theme_color: "#040404",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

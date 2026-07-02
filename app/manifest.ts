import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stockpot",
    short_name: "Stockpot",
    description:
      "Manage kitchen stock, plan meals, and update inventory from shared grocery images.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f0df",
    theme_color: "#8b6d49",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    share_target: {
      action: "/share/stock-image",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: {
          name: "stockImage",
          accept: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
        },
      },
    },
    shortcuts: [
      {
        name: "Update stock from image",
        short_name: "Stock image",
        description: "Share a grocery image into Stockpot stock review.",
        url: "/?stockImageShared=1",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kismet Score · Manoel × Ana",
    short_name: "Kismet",
    description: "Placar e cartela ao vivo das partidas de Kismet entre Manoel e Ana.",
    start_url: "/registrar",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07060d",
    theme_color: "#07060d",
    lang: "pt-BR",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Partida ao vivo", short_name: "Partida", url: "/registrar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Placar", short_name: "Placar", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

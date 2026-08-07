import type { MetadataRoute } from "next";

// Golfers add this to the home screen and run it one-handed in sunlight for four
// hours, so it wants a name, an icon and a standalone frame rather than a Safari
// tab with a blank favicon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bulldogs Golf Day",
    short_name: "Golf Day",
    description: "Live scoring, on-course fundraising and photos for Denver Bulldogs Golf Day.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f2ed",
    theme_color: "#0d1e48",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}

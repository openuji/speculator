// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import path from "node:path";
import { LikeC4VitePlugin } from "likec4/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const tailwindPlugin = /** @type {any} */ (tailwindcss());
const likeC4Plugin = /** @type {any} */ (
  LikeC4VitePlugin({
    workspace: path.resolve("src/spec/workspaces"),
  })
);

export default defineConfig({
  site: "https://example.com",
  integrations: [react()],
  vite: {
    plugins: [tailwindPlugin, likeC4Plugin],
  },
});

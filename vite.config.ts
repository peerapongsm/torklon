import { defineConfig } from "vite";

export default defineConfig({
  base: "/", // custom domain torklon.peerapongsm.dev — no basePath
  test: { environment: "jsdom" },
});

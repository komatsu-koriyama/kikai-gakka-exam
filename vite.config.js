import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/kikai-gakka-exam/",
  plugins: [react()],
});
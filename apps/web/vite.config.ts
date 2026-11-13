import { createReadStream, existsSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const contentTypes: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".json": "application/json",
  ".png": "image/png",
};

function localAssets(root: string): Plugin {
  const assetRoot = resolve(root);
  return {
    name: "guildhub-local-model-assets",
    configureServer(server) {
      server.middlewares.use("/assets", (request, response, next) => {
        try {
          const pathname = new URL(request.url ?? "/", "http://localhost")
            .pathname;
          const file = resolve(assetRoot, `.${decodeURIComponent(pathname)}`);
          if (relative(assetRoot, file).startsWith("..")) {
            response.statusCode = 403;
            response.end();
            return;
          }
          response.setHeader(
            "Content-Type",
            contentTypes[extname(file)] ?? "application/octet-stream",
          );
          createReadStream(file)
            .on("error", () => {
              next();
            })
            .pipe(response);
        } catch {
          next();
        }
      });
    },
  };
}

const localProofAssets = resolve(
  import.meta.dirname,
  "../model-baker/assets/proof/rogue-t2",
);
const assetRoot =
  process.env.GUILDHUB_ASSET_ROOT ??
  (existsSync(localProofAssets) ? localProofAssets : undefined);

export default defineConfig({
  plugins: [react(), ...(assetRoot ? [localAssets(assetRoot)] : [])],
  publicDir: "test-fixtures",
  build: {
    assetsDir: "static",
    sourcemap: true,
  },
});

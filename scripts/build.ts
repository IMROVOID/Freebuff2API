import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

async function build(): Promise<void> {
  const distDir = path.resolve(process.cwd(), "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log("Building Freebuff2API dual targets...");

  // 1. Build CLI (Node.js)
  console.log("-> Building dist/cli.js (Node.js CLI daemon)...");
  await esbuild.build({
    entryPoints: ["src/cli/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    outfile: "dist/cli.js",
    banner: {
      js: "#!/usr/bin/env node\n",
    },
    sourcemap: true,
    external: [],
  });

  // Ensure executable permissions on POSIX
  try {
    fs.chmodSync("dist/cli.js", 0o755);
  } catch {
    // Windows ignore
  }

  // 2. Build Cloudflare Worker
  console.log("-> Building worker.js (Cloudflare Worker ESM)...");
  await esbuild.build({
    entryPoints: ["src/worker/index.ts"],
    bundle: true,
    platform: "browser",
    target: "es2022",
    format: "esm",
    outfile: "worker.js",
    sourcemap: true,
    mainFields: ["browser", "module", "main"],
    conditions: ["worker", "browser"],
  });

  console.log("Build completed successfully.");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});

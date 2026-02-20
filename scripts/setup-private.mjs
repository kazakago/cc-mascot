#!/usr/bin/env node
/**
 * setup-private.mjs
 *
 * private-src/ サブモジュール（kazakago/cc-mascot-private）を最新状態に更新し、
 * private-src/animations/<category>/ 配下の VRMA ファイルを
 * public/animations/<category>/ にコピーするスクリプト。
 *
 * Usage:
 *   npm run setup:private
 *
 * サブモジュールが未初期化の場合は自動で初期化します（.gitmodules が設定済みのため）。
 */

import { execSync } from "child_process";
import { readdir, copyFile, mkdir, access } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const srcDir = join(rootDir, "private-src", "animations");
const destDir = join(rootDir, "public", "animations");

const CATEGORIES = ["idle", "happy", "angry", "sad", "relaxed", "surprised"];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(srcDir))) {
    console.log("private-src/ not found. Initializing submodule...");
    execSync("git submodule update --init private-src", { stdio: "inherit", cwd: rootDir });
  } else {
    console.log("Updating submodule to latest...");
    execSync("git submodule update --remote private-src", { stdio: "inherit", cwd: rootDir });
  }

  for (const category of CATEGORIES) {
    const categorySrcDir = join(srcDir, category);
    const categoryDestDir = join(destDir, category);

    if (!(await exists(categorySrcDir))) {
      console.warn(`Warning: Category '${category}' not found in private-src/animations/, skipping.`);
      continue;
    }

    await mkdir(categoryDestDir, { recursive: true });

    const files = await readdir(categorySrcDir);
    const vrmaFiles = files.filter((f) => extname(f) === ".vrma").sort();

    for (const file of vrmaFiles) {
      await copyFile(join(categorySrcDir, file), join(categoryDestDir, file));
    }

    console.log(`[${category}] ${vrmaFiles.length} file(s) copied.`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

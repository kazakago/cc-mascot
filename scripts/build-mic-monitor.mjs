import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { platform } from "os";
import { dirname } from "path";

const SOURCE = "helpers/mic-monitor.swift";
const OUTPUT = "resources/mic-monitor";

if (platform() !== "darwin") {
  console.log("[build-mic-monitor] Skipping: not macOS");
  process.exit(0);
}

if (!existsSync(SOURCE)) {
  console.error(`[build-mic-monitor] Source not found: ${SOURCE}`);
  process.exit(1);
}

// Ensure output directory exists
const outputDir = dirname(OUTPUT);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

try {
  console.log("[build-mic-monitor] Compiling Swift helper...");
  execSync(`swiftc -O -framework CoreAudio -o ${OUTPUT} ${SOURCE}`, {
    stdio: "inherit",
  });
  // Ensure executable permission
  execSync(`chmod +x ${OUTPUT}`);
  console.log(`[build-mic-monitor] Built: ${OUTPUT}`);
} catch (error) {
  console.error("[build-mic-monitor] Compilation failed:", error.message);
  process.exit(1);
}

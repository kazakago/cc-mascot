import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { platform } from "os";
import { dirname, join } from "path";

const currentPlatform = platform();

// Ensure output directory exists
function ensureOutputDir(outputPath) {
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
}

// macOS: Compile Swift helper with CoreAudio
function buildDarwin() {
  const source = "helpers/mic-monitor.swift";
  const output = "resources/mic-monitor";

  if (!existsSync(source)) {
    console.error(`[build-mic-monitor] Source not found: ${source}`);
    process.exit(1);
  }

  ensureOutputDir(output);

  try {
    console.log("[build-mic-monitor] Compiling Swift helper...");
    execSync(`swiftc -O -framework CoreAudio -o ${output} ${source}`, {
      stdio: "inherit",
    });
    execSync(`chmod +x ${output}`);
    console.log(`[build-mic-monitor] Built: ${output}`);
  } catch (error) {
    console.error("[build-mic-monitor] Compilation failed:", error.message);
    process.exit(1);
  }
}

// Windows: Compile C++ helper with MSVC
function buildWin32() {
  const source = "helpers/mic-monitor.cpp";
  const output = "resources/mic-monitor.exe";

  if (!existsSync(source)) {
    console.error(`[build-mic-monitor] Source not found: ${source}`);
    process.exit(1);
  }

  ensureOutputDir(output);

  // Find Visual Studio installation using vswhere.exe
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const vswhere = join(programFilesX86, "Microsoft Visual Studio", "Installer", "vswhere.exe");

  if (!existsSync(vswhere)) {
    console.error("[build-mic-monitor] vswhere.exe not found. Visual Studio Build Tools required.");
    process.exit(1);
  }

  let vsPath;
  try {
    console.log("[build-mic-monitor] Querying Visual Studio installation...");
    // Search for both BuildTools and Enterprise editions (GitHub Actions runners have Enterprise)
    vsPath = execSync(
      `"${vswhere}" -products * -latest -property installationPath -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64`,
      {
        encoding: "utf8",
      },
    ).trim();
    console.log(`[build-mic-monitor] VS Path: ${vsPath}`);
  } catch {
    console.error("[build-mic-monitor] Failed to find Visual Studio installation.");
    process.exit(1);
  }

  if (!vsPath) {
    console.error(
      '[build-mic-monitor] Visual Studio Build Tools not found. Install with: winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"',
    );
    process.exit(1);
  }

  const vcvarsall = join(vsPath, "VC", "Auxiliary", "Build", "vcvarsall.bat");
  if (!existsSync(vcvarsall)) {
    console.error(`[build-mic-monitor] vcvarsall.bat not found: ${vcvarsall}`);
    process.exit(1);
  }

  try {
    console.log("[build-mic-monitor] Compiling C++ helper with MSVC...");
    // MSVC outputs .obj files to the current directory, not the source directory
    const objFileName = source.split("/").pop().replace(".cpp", ".obj");
    execSync(`cmd /c ""${vcvarsall}" x64 && cl /O2 /EHsc ${source} Ole32.lib /Fe:${output} && del ${objFileName}"`, {
      stdio: "inherit",
    });
    console.log(`[build-mic-monitor] Built: ${output}`);
  } catch (error) {
    console.error("[build-mic-monitor] Compilation failed:", error.message);
    process.exit(1);
  }
}

if (currentPlatform === "darwin") {
  buildDarwin();
} else if (currentPlatform === "win32") {
  buildWin32();
} else {
  console.log(`[build-mic-monitor] Skipping: unsupported platform (${currentPlatform})`);
}

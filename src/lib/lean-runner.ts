import { Sandbox } from "@vercel/sandbox";

let sandboxInstance: (Sandbox & AsyncDisposable) | null = null;
let leanInstalled = false;

async function getSandbox(): Promise<Sandbox> {
  if (sandboxInstance) {
    try {
      await sandboxInstance.runCommand("echo", ["ok"]);
      return sandboxInstance;
    } catch {
      sandboxInstance = null;
      leanInstalled = false;
    }
  }

  console.log("[lean-runner] Creating sandbox...");
  sandboxInstance = await Sandbox.create({
    timeout: 5 * 60 * 1000,
  });
  console.log("[lean-runner] Sandbox created:", sandboxInstance.sandboxId);

  return sandboxInstance;
}

async function ensureLeanInstalled(sandbox: Sandbox): Promise<void> {
  if (leanInstalled) return;

  console.log("[lean-runner] Installing elan and Lean 4...");

  // Step 1: Download elan installer
  const downloadResult = await sandbox.runCommand("bash", [
    "-c",
    "curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -o /tmp/elan-init.sh && chmod +x /tmp/elan-init.sh && echo OK",
  ]);
  const dlOut = await downloadResult.stdout();
  console.log("[lean-runner] Download result:", downloadResult.exitCode, dlOut.trim());

  if (downloadResult.exitCode !== 0) {
    const errMsg = await downloadResult.stderr();
    throw new Error(`Failed to download elan: ${errMsg}`);
  }

  // Step 2: Run elan installer
  const installResult = await sandbox.runCommand("bash", [
    "-c",
    "bash /tmp/elan-init.sh --default-toolchain leanprover/lean4:v4.16.0 --no-modify-path -y 2>&1",
  ]);
  const installOut = await installResult.stdout();
  console.log("[lean-runner] Install result:", installResult.exitCode, installOut.substring(0, 200));

  if (installResult.exitCode !== 0) {
    throw new Error(`Failed to install elan: ${installOut}`);
  }

  // Step 3: Verify lean is available
  const verifyResult = await sandbox.runCommand("bash", [
    "-c",
    "$HOME/.elan/bin/lean --version 2>&1",
  ]);
  const versionOutput = await verifyResult.stdout();
  console.log("[lean-runner] Lean version:", versionOutput.trim());

  if (verifyResult.exitCode !== 0) {
    throw new Error(`Lean not found after install: ${versionOutput}`);
  }

  leanInstalled = true;
}

export interface LeanResult {
  success: boolean;
  output: string;
  errors: string;
  leanCode: string;
}

export async function runLeanCode(code: string): Promise<LeanResult> {
  const sandbox = await getSandbox();
  await ensureLeanInstalled(sandbox);

  // Write the Lean file to the sandbox working directory
  await sandbox.writeFiles([
    {
      path: "Proof.lean",
      content: Buffer.from(code, "utf-8"),
    },
  ]);

  // Run lean on the file
  const result = await sandbox.runCommand("bash", [
    "-c",
    "$HOME/.elan/bin/lean Proof.lean 2>&1",
  ]);

  const stdout = await result.stdout();
  const stderr = await result.stderr();
  const combinedOutput = stdout + stderr;

  const success =
    result.exitCode === 0 &&
    !combinedOutput.includes("error") &&
    !combinedOutput.includes("unknown identifier") &&
    !combinedOutput.includes("type mismatch");

  return {
    success,
    output: stdout.trim(),
    errors: stderr.trim() || stdout.trim(),
    leanCode: code,
  };
}

export async function cleanupSandbox(): Promise<void> {
  if (sandboxInstance) {
    await sandboxInstance.stop();
    sandboxInstance = null;
    leanInstalled = false;
  }
}

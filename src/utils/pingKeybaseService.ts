import keybaseExec from "./keybaseExec.js";

/**
 * Checks whether the keybase service is running by calling `keybase status --json`.
 */
async function pingKeybaseService(
  workingDir: string,
  homeDir?: string | null,
): Promise<boolean> {
  try {
    await keybaseExec(workingDir, homeDir, ["--no-auto-fork", "status", "--json"], { json: true });
    return true;
  } catch {
    return false;
  }
}

export default pingKeybaseService;

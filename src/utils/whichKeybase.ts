import which from "which";
import keybaseBinaryName from "./keybaseBinaryName.js";

/**
 * Returns the full path to the keybase binary or throws an error.
 * @example
 * whichKeybase().then((path) => console.log(path))
 */
async function whichKeybase(customPath?: string): Promise<string> {
  if (customPath) {
    // Caller provided an explicit path - verify it is executable via which
    try {
      return await which(customPath);
    } catch {
      throw new Error(`Keybase binary not found at configured path: ${customPath}`);
    }
  }
  try {
    return await which(keybaseBinaryName);
  } catch {
    throw new Error(
      `Could not find '${keybaseBinaryName}' on PATH. Install Keybase from https://keybase.io/download`,
    );
  }
}

export default whichKeybase;

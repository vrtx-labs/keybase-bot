import keybaseExec from "./keybaseExec.js";

/**
 * Useful information like the username, device, home directory of your bot and
 * configuration options.
 */
export interface BotInfo {
  username: string;
  devicename: string;
  homeDir?: string;
  botLite?: boolean;
  disableTyping?: boolean;
  debugLogging?: boolean;
}

/**
 * Returns { username, devicename, homeDir } from `keybase status --json`.
 */
async function keybaseStatus(
  workingDir: string,
  homeDir?: string | null,
): Promise<BotInfo> {
  const status = await keybaseExec(workingDir, homeDir, ["status", "--json"], { json: true });
  if (status && status.Username && status.Device?.name) {
    return {
      username: status.Username,
      devicename: status.Device.name,
      homeDir: homeDir ?? undefined,
    };
  }
  throw new Error("Failed to get current username and device name.");
}

export default keybaseStatus;

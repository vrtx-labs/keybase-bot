import fs from "fs/promises";

/**
 * Recursively removes a directory and all its contents.
 * Uses Node.js built-in fs.rm with the recursive option (Node 14.14+).
 */
async function rmdirRecursive(dirName: string): Promise<void> {
  await fs.rm(dirName, { recursive: true, force: true });
}

export default rmdirRecursive;

import { spawn } from "child_process";
import readline from "readline";
import path from "path";
import keybaseBinaryName from "./keybaseBinaryName.js";

export type ExecOptions = {
  stdinBuffer?: Buffer | string;
  onStdOut?: (line: string) => void;
  json?: boolean;
  timeout?: number;
};

const keybaseExec = (
  workingDir: string,
  homeDir: string | undefined | null,
  args: string[],
  options: ExecOptions = {},
): Promise<any> => {
  const runArgs: string[] = [...args];
  if (homeDir) {
    runArgs.unshift("--home", homeDir);
  }
  const keybasePath = path.join(workingDir, keybaseBinaryName);
  const child = spawn(keybasePath, runArgs);
  const stdOutBuffer: Buffer[] = [];
  const stdErrBuffer: Buffer[] = [];

  if (options.stdinBuffer) {
    child.stdin.write(options.stdinBuffer);
  }
  child.stdin.end();

  const lineReaderStdout = readline.createInterface({ input: child.stdout });

  if (options.onStdOut) {
    lineReaderStdout.on("line", options.onStdOut);
  } else {
    child.stdout.on("data", (chunk: Buffer) => {
      stdOutBuffer.push(chunk);
    });
  }

  child.stderr.on("data", (chunk: Buffer) => {
    stdErrBuffer.push(chunk);
  });

  let timerHandle: ReturnType<typeof setTimeout> | undefined;
  if (options.timeout) {
    timerHandle = setTimeout(() => {
      child.kill();
    }, options.timeout);
  }

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (timerHandle !== undefined) {
        clearTimeout(timerHandle);
      }

      if (code) {
        const errorMessage = Buffer.concat(stdErrBuffer).toString("utf8");
        return reject(new Error(errorMessage));
      }

      const stdout = Buffer.concat(stdOutBuffer).toString("utf8");
      try {
        const result = options.json ? JSON.parse(stdout) : stdout;
        return resolve(result);
      } catch (e) {
        return reject(e);
      }
    });
  });
};

export default keybaseExec;

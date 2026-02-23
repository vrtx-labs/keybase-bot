import fs from "fs/promises";
import { copyFile, appendFile } from "fs/promises";
import os from "os";
import path from "path";
import { timeout } from "./index.js";

export class AdminDebugLogger {
  private _logDir?: string;
  private _botId: string;
  private _botServiceLogPath?: string;
  private _deinitYet: boolean;

  public get directory(): string | null {
    return this._logDir ?? null;
  }

  public get filename(): string | null {
    if (this.directory) {
      return path.join(this.directory, `keybase_bot_${this._botId}.bot.log`);
    }
    return null;
  }

  public constructor(botId: string) {
    this._botId = botId;
    this._deinitYet = false;
  }

  public async init(logDir: string, botServiceLogPath: string): Promise<void> {
    this._botServiceLogPath = botServiceLogPath;
    this._logDir = logDir;
    if (this.directory) {
      await fs.mkdir(this.directory, { recursive: true });
    }
    void this._copyLoop();
  }

  public deinit(): void {
    this._deinitYet = true;
  }

  public async info(text: string): Promise<void> {
    await this._logIt(text, "I");
  }

  public async error(text: string): Promise<void> {
    await this._logIt(text, "E");
  }

  private async _logIt(text: string, code: "E" | "I"): Promise<void> {
    if (this.directory && this.filename) {
      const line = `${new Date().toISOString()} [${code}] ${text}${os.EOL}`;
      await appendFile(this.filename, line, "utf-8");
    }
  }

  private async _copyLoop(): Promise<void> {
    while (!this._deinitYet) {
      try {
        if (this.directory && this._botServiceLogPath) {
          const destination = path.join(this.directory, `keybase_bot_${this._botId}.service.log`);
          await copyFile(this._botServiceLogPath, destination);
        }
      } catch (e) {
        await this.error(`Couldn't copy service log. ${String(e)}`);
      }
      await timeout(900);
    }
  }
}

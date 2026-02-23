import { keybaseExec, keybaseStatus, pingKeybaseService, timeout } from "../utils/index.js";
import { spawn } from "child_process";
import type { BotInfo } from "../utils/keybaseStatus.js";
import type { InitOptions } from "../utils/options.js";
import keybaseBinaryName from "../utils/keybaseBinaryName.js";
import path from "path";
import type { AdminDebugLogger } from "../utils/adminDebugLogger.js";

class Service {
  public initialized: false | "paperkey" | "runningService";
  public running: boolean;
  public username?: string;
  public devicename?: string;
  public homeDir?: string;
  public verbose: boolean;
  public botLite: boolean;
  public disableTyping: boolean;
  public serviceLogFile?: string;
  public workingDir: string;
  public autoLogSendOnCrash: boolean;
  private _paperkey?: string;
  private _useDetachedService: boolean;
  private _debugLogging: boolean;
  protected _adminDebugLogger: AdminDebugLogger;

  public constructor(workingDir: string, adminDebugLogger: AdminDebugLogger, debugLogging: boolean) {
    this._adminDebugLogger = adminDebugLogger;
    this.workingDir = workingDir;
    this.initialized = false;
    this.verbose = false;
    this.botLite = true;
    this.disableTyping = true;
    this.autoLogSendOnCrash = false;
    this._useDetachedService = false;
    this._debugLogging = debugLogging;
    this.running = false;
  }

  public async init(username: string, paperkey: string, options?: InitOptions): Promise<void> {
    if (!username || typeof username !== "string") {
      throw new Error(`Please provide a username to initialize the bot. Got: ${JSON.stringify(username)}`);
    }
    if (!paperkey || typeof paperkey !== "string") {
      throw new Error("Please provide a paperkey to initialize the bot.");
    }
    if (this.initialized) {
      throw new Error("Cannot initialize an already initialized bot.");
    }
    if (options?.useDetachedService) {
      this._useDetachedService = true;
    }

    this.homeDir = this.workingDir;
    this.serviceLogFile = path.join(this.homeDir, "logs", "keybase.service.log");
    this.botLite = options?.botLite !== false;
    this.disableTyping = options?.disableTyping !== false;
    this.autoLogSendOnCrash = options?.autoLogSendOnCrash === true;

    try {
      await this.startupService();
      await keybaseExec(this.workingDir, this.homeDir, ["oneshot", "--username", username], {
        stdinBuffer: paperkey,
      });

      await keybaseExec(this.workingDir, this.homeDir, [
        "chat",
        "notification-settings",
        `--disable-typing=${this.disableTyping.toString()}`,
      ]);

      const currentInfo = await keybaseStatus(this.workingDir, this.homeDir);

      if (currentInfo?.username && currentInfo?.devicename) {
        this.initialized = "paperkey";
        this.username = currentInfo.username;
        this._paperkey = paperkey;
        this.devicename = currentInfo.devicename;
        this.verbose = options?.verbose === true;
      }
      if (this.username !== username) {
        throw new Error("Failed to initialize service.");
      }
    } catch (err) {
      await this._killCustomService();
      throw err;
    }
  }

  public async initFromRunningService(homeDir?: string, options?: InitOptions): Promise<void> {
    if (this.initialized) {
      throw new Error("Cannot initialize an already initialized bot.");
    }
    this.homeDir = homeDir;
    const currentInfo = await keybaseStatus(this.workingDir, this.homeDir);
    if (currentInfo?.username && currentInfo?.devicename) {
      this.initialized = "runningService";
      this.username = currentInfo.username;
      this.devicename = currentInfo.devicename;
      this.verbose = options?.verbose === true;
    }
  }

  private async _killCustomService(): Promise<void> {
    try {
      await keybaseExec(this.workingDir, this.homeDir, ["logout", "--force"]);
    } catch {
      // ignore
    }
    try {
      await keybaseExec(this.workingDir, this.homeDir, ["ctl", "stop", "--shutdown"]);
    } catch {
      // ignore
    }
    // Wait for process to quit
    let i = 0;
    while (true) {
      await timeout(100);
      if (!this.running) break;
      if (++i >= 100) {
        throw new Error(`The service didn't finish shutting down in time (${this.workingDir})`);
      }
    }
  }

  public async deinit(): Promise<void> {
    if (!this.initialized) {
      throw new Error("Cannot deinitialize an uninitialized bot.");
    }
    if (this.initialized === "paperkey") {
      await this._killCustomService();
    }
    this.initialized = false;
  }

  public myInfo(): BotInfo | undefined {
    if (this.username && this.devicename) {
      return {
        username: this.username,
        devicename: this.devicename,
        homeDir: this.homeDir ?? undefined,
        botLite: this.botLite,
        disableTyping: this.disableTyping,
        debugLogging: this._debugLogging,
      };
    }
    return undefined;
  }

  public async startupService(): Promise<void> {
    const args: string[] = [];
    if (this.homeDir) {
      args.push("--home", this.homeDir);
    }
    if (this.serviceLogFile) {
      args.push("--log-file", this.serviceLogFile);
    }
    if (this.botLite) {
      args.push("--enable-bot-lite-mode");
    }
    args.push("service");

    const child = spawn(path.join(this.workingDir, keybaseBinaryName), args, {
      env: process.env,
      detached: this._useDetachedService,
    });

    this.running = true;
    child.on("exit", async (code): Promise<void> => {
      this.running = false;
      if (code !== 0 && this.autoLogSendOnCrash) {
        await this.logSend();
      }
    });

    return new Promise((resolve, reject): void => {
      child.on("close", (code): void => {
        reject(new Error(`keybase service exited with code ${code} (${this.workingDir})`));
      });

      const poll = async (): Promise<void> => {
        let i = 0;
        while (!(await pingKeybaseService(this.workingDir, this.homeDir))) {
          await timeout(100);
          if (++i >= 100) {
            reject(new Error("Couldn't start up service fast enough"));
            return;
          }
        }
        resolve();
      };
      void poll();
    });
  }

  public async logSend(): Promise<void> {
    const initiallyRunning = this.running;
    if (!initiallyRunning) {
      try {
        await this.startupService();
        if (this.initialized === "paperkey" && this.username && this._paperkey) {
          await keybaseExec(this.workingDir, this.homeDir, ["oneshot", "--username", this.username], {
            stdinBuffer: this._paperkey,
          });
        }
      } catch {
        // ignore
      }
    }

    const feedback = `keybase-bot auto log send\nusername: ${this.username ?? "none"}\ninitialized: ${this.initialized || "false"}`;
    const args = ["log", "send", "--no-confirm", "--feedback", feedback];
    if (this.serviceLogFile) {
      args.unshift("--log-file", this.serviceLogFile);
    }
    await keybaseExec(this.workingDir, this.homeDir, args);

    if (!initiallyRunning) {
      await this._killCustomService();
    }
  }
}

export default Service;

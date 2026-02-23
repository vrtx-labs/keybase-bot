import fs from "fs/promises";
import { copyFile } from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import Service from "./service/index.js";
import ChatClient from "./chat-client/index.js";
import WalletClient from "./wallet-client/index.js";
import TeamClient from "./team-client/index.js";
import HelpersClient from "./helpers-client/index.js";
import KVStoreClient from "./kvstore-client/index.js";
import type { BotInfo } from "./utils/keybaseStatus.js";
import { keybaseBinaryName, whichKeybase, rmdirRecursive } from "./utils/index.js";
import type { InitOptions } from "./utils/options.js";
import { AdminDebugLogger } from "./utils/adminDebugLogger.js";

export type { BotInfo } from "./utils/keybaseStatus.js";
export type { InitOptions } from "./utils/options.js";
export type { OnMessage, OnError, OnConv, ListenOptions } from "./chat-client/index.js";
export * as chat1 from "./types/chat1/index.js";
export * as keybase1 from "./types/keybase1/index.js";
export * as stellar1 from "./types/stellar1/index.js";

interface BotConstructorOpts {
  debugLogging?: boolean;
}

/** A Keybase bot. */
export class Bot {
  public chat: ChatClient;
  public wallet: WalletClient;
  public team: TeamClient;
  public helpers: HelpersClient;
  public kvstore: KVStoreClient;
  private _workingDir: string;
  private _service: Service;
  private _botId: string;
  private _initStatus: "preinit" | "initializing" | "initialized" | "deinitializing" | "deinitialized";
  private _adminDebugLogger: AdminDebugLogger;

  /**
   * Create a bot. You must call `init()` or `initFromRunningService()` before using the bot.
   * @example
   * const bot = new Bot()
   */
  public constructor(opts?: BotConstructorOpts) {
    const debugLogging = opts?.debugLogging ?? false;
    this._botId = crypto.randomBytes(16).toString("hex");
    this._workingDir = path.join(os.tmpdir(), `keybase_bot_${this._botId}`);
    this._adminDebugLogger = new AdminDebugLogger(this._botId);
    this._service = new Service(this._workingDir, this._adminDebugLogger, debugLogging);
    this.chat = new ChatClient(this._workingDir, this._adminDebugLogger);
    this.wallet = new WalletClient(this._workingDir, this._adminDebugLogger);
    this.team = new TeamClient(this._workingDir, this._adminDebugLogger);
    this.helpers = new HelpersClient(this._workingDir, this._adminDebugLogger);
    this.kvstore = new KVStoreClient(this._workingDir, this._adminDebugLogger);
    this._initStatus = "preinit";
  }

  /**
   * Initialize your bot by starting an instance of the Keybase service and logging in using oneshot mode.
   * @param username - The username of your bot's Keybase account.
   * @param paperkey - The paperkey of your bot's Keybase account.
   * @param options - The initialization options for your bot.
   * @example
   * await bot.init('username', 'paperkey')
   */
  public async init(username: string, paperkey: string, options?: InitOptions): Promise<void> {
    this._beginInitState();
    await this._prepWorkingDir(options?.keybaseBinaryLocation);
    await this._service.init(username, paperkey, options);
    await this._initSubBots();
    if (options?.adminDebugDirectory && this._service.serviceLogFile) {
      await this._adminDebugLogger.init(options.adminDebugDirectory, this._service.serviceLogFile);
    }
    this._initStatus = "initialized";
    this._adminDebugLogger.info("initialized");
  }

  /**
   * Initialize your bot by using an existing running service with a logged in user.
   * @param homeDir - The home directory of this currently running service. Leave blank to use the default.
   * @param options - The initialization options for your bot.
   * @example
   * await bot.initFromRunningService()
   */
  public async initFromRunningService(homeDir?: string, options?: InitOptions): Promise<void> {
    this._beginInitState();
    await this._prepWorkingDir(options?.keybaseBinaryLocation);
    if (options?.adminDebugDirectory && this._service.serviceLogFile) {
      await this._adminDebugLogger.init(options.adminDebugDirectory, this._service.serviceLogFile);
    }
    await this._service.initFromRunningService(homeDir, options);
    await this._initSubBots();
    this._adminDebugLogger.info("initialized");
  }

  private _beginInitState(): void {
    if (this._initStatus !== "preinit") {
      throw new Error(`tried to init, but state is already ${this._initStatus}`);
    }
    this._initStatus = "initializing";
    this._adminDebugLogger.info("beginning initialization");
  }

  /**
   * Get info about your bot.
   * @returns Useful information about the bot, or `null` if not initialized.
   * @example
   * const info = bot.myInfo()
   */
  public myInfo(): BotInfo | null {
    return this._service.myInfo() ?? null;
  }

  /**
   * Deinitializes the bot: logs out, stops the keybase service, and removes any leftover files.
   * Always call this when your bot is done.
   * @example
   * await bot.deinit()
   */
  public async deinit(): Promise<void> {
    if (this._initStatus === "deinitializing" || this._initStatus === "deinitialized") {
      this._adminDebugLogger.info("deinit called but already called");
      return;
    }
    this._initStatus = "deinitializing";
    this._adminDebugLogger.info("beginning deinit");
    await this.chat._deinit();
    await this._service.deinit();
    await rmdirRecursive(this._workingDir);
    this._adminDebugLogger.info("finished deinit");
    this._adminDebugLogger.deinit();
    this._initStatus = "deinitialized";
  }

  /**
   * Write an info message to the admin debug log directory (if configured).
   * @example
   * await bot.adminDebugLogInfo('My bot is ready to go.')
   */
  public async adminDebugLogInfo(text: string): Promise<void> {
    this._adminDebugLogger.info(text);
  }

  /**
   * Write an error message to the admin debug log directory (if configured).
   */
  public async adminDebugLogError(text: string): Promise<void> {
    this._adminDebugLogger.error(text);
  }

  /**
   * Send Keybase service daemon logs to Keybase.
   */
  public async logSend(): Promise<void> {
    return this._service.logSend();
  }

  public get botId(): string {
    return this._botId;
  }

  public get serviceLogLocation(): string {
    if (this._service.serviceLogFile) {
      return this._service.serviceLogFile;
    }
    throw new Error("service does not have a log file location. initialized yet?");
  }

  private async _prepWorkingDir(keybaseBinaryLocation?: string): Promise<void> {
    const resolved = await whichKeybase(keybaseBinaryLocation);
    const destination = path.join(this._workingDir, keybaseBinaryName);
    await fs.mkdir(this._workingDir, { recursive: true });
    await copyFile(resolved, destination);
  }

  private async _initSubBots(): Promise<void> {
    const info = this.myInfo();
    if (!info) {
      throw new Error("Issue initializing bot.");
    }
    await this.chat._init(info.homeDir);
    await this.wallet._init(info.homeDir);
    await this.team._init(info.homeDir);
    await this.helpers._init(info.homeDir);
    await this.kvstore._init(info.homeDir);
  }
}

export default Bot;

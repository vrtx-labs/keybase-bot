import { spawn } from "child_process";
import readline from "readline";
import ClientBase from "../client-base/index.js";
import { formatAPIObjectOutput, formatAPIObjectInput } from "../utils/index.js";
import type * as chat1 from "../types/chat1/index.js";

/** A function to call when a message is received. */
export type OnMessage = (message: chat1.MsgSummary) => void | Promise<void>;
/** A function to call when an error occurs. */
export type OnError = (error: Error) => void | Promise<void>;
/** A function to call when the bot is added to a new conversation. */
export type OnConv = (channel: chat1.ConvSummary) => void | Promise<void>;

export interface ChatListOptions {
  failOffline?: boolean;
  showErrors?: boolean;
  topicType?: chat1.TopicType;
  unreadOnly?: boolean;
}

export interface ChatListChannelsOptions {
  topicType?: chat1.TopicType;
  membersType?: chat1.ConversationMembersType;
}

export interface ChatReadOptions {
  failOffline?: boolean;
  pagination?: chat1.Pagination;
  peek?: boolean;
  unreadOnly?: boolean;
}

export interface ChatSendOptions {
  nonblock?: boolean;
  membersType?: chat1.ConversationMembersType;
  confirmLumenSend?: boolean;
  replyTo?: chat1.MessageID;
  explodingLifetime?: number;
}

export interface ChatAttachOptions {
  title?: string;
  preview?: string;
  explodingLifetime?: number;
  /** Send as an audio message with waveform and duration metadata. */
  isAudio?: boolean;
  /** Audio duration in milliseconds. Auto-detected from MP4/M4A files if omitted. */
  audioDurationMs?: number;
  /** Waveform amplitude data (0.0-1.0). Auto-generated if omitted. */
  audioAmps?: number[];
}

export interface ChatDownloadOptions {
  preview?: string;
  noStream?: boolean;
}

/**
 * Options for the methods in the chat module that listen for new messages.
 */
export interface ListenOptions {
  hideExploding: boolean;
  showLocal: boolean;
}

export interface Advertisement {
  alias?: string;
  advertisements: chat1.AdvertiseCommandAPIParam[];
}

export interface AdvertisementsLookup {
  channel: chat1.ChatChannel;
  conversationID?: string;
}

export interface ReadResult {
  messages: chat1.MsgSummary[];
  pagination: chat1.Pagination;
}

/** The chat module of your Keybase bot. */
class Chat extends ClientBase {
  public async list(options?: ChatListOptions): Promise<chat1.ConvSummary[]> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "chat", method: "list", options });
    if (!res) throw new Error("Keybase chat list returned nothing.");
    return res.conversations || [];
  }

  public async listChannels(
    name: string,
    options?: ChatListChannelsOptions,
  ): Promise<chat1.ConvSummary[]> {
    await this._guardInitialized();
    const optionsWithDefaults = {
      ...options,
      name,
      membersType: options?.membersType ?? "team",
    };
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "listconvsonname",
      options: optionsWithDefaults,
    });
    if (!res) throw new Error("Keybase chat list convs on name returned nothing.");
    return res.conversations || [];
  }

  private getChannelOrConversationId(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
  ): { channel?: chat1.ChatChannel; conversationId?: chat1.ConvIDStr } {
    if (typeof channelOrConversationId === "string") {
      return { conversationId: channelOrConversationId };
    }
    return { channel: channelOrConversationId };
  }

  public async read(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
    options?: ChatReadOptions,
  ): Promise<ReadResult> {
    await this._guardInitialized();
    const conv = this.getChannelOrConversationId(channelOrConversationId);
    const optionsWithDefaults = {
      ...options,
      ...conv,
      peek: options?.peek ?? false,
      unreadOnly: options?.unreadOnly ?? false,
    };
    const res = await this._runApiCommand({ apiName: "chat", method: "read", options: optionsWithDefaults });
    if (!res) throw new Error("Keybase chat read returned nothing.");
    return {
      pagination: res.pagination,
      messages: res.messages.map((message: chat1.MsgNotification): chat1.MsgSummary => message.msg!),
    };
  }

  public async joinChannel(channel: chat1.ChatChannel): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "chat", method: "join", options: { channel } });
    if (!res) throw new Error("Keybase chat join returned nothing");
  }

  public async leaveChannel(channel: chat1.ChatChannel): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "chat", method: "leave", options: { channel } });
    if (!res) throw new Error("Keybase chat leave returned nothing");
  }

  public async send(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
    message: chat1.ChatMessage,
    options?: ChatSendOptions,
  ): Promise<chat1.SendRes> {
    await this._guardInitialized();
    const conv = this.getChannelOrConversationId(channelOrConversationId);
    const args = {
      ...options,
      explodingLifetime: options?.explodingLifetime ? `${options.explodingLifetime}ms` : undefined,
      ...conv,
      message,
    };
    this._adminDebugLogger.info(
      `sending message "${message.body}" in conversation ${JSON.stringify(conv)}`,
    );
    const res = await this._runApiCommand({ apiName: "chat", method: "send", options: args });
    if (!res) throw new Error("Keybase chat send returned nothing");
    this._adminDebugLogger.info(`message sent with id ${res.id}`);
    return res;
  }

  public async createChannel(channel: chat1.ChatChannel): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "chat", method: "newconv", options: { channel } });
    if (!res) throw new Error("Keybase chat newconv returned nothing");
  }

  public async attach(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
    filename: string,
    options?: ChatAttachOptions,
  ): Promise<chat1.SendRes> {
    await this._guardInitialized();
    const conv = this.getChannelOrConversationId(channelOrConversationId);
    const args = {
      ...options,
      explodingLifetime: options?.explodingLifetime ? `${options.explodingLifetime}ms` : undefined,
      ...conv,
      filename,
    };
    const res = await this._runApiCommand({ apiName: "chat", method: "attach", options: args });
    if (!res) throw new Error("Keybase chat attach returned nothing");
    return res;
  }

  public async download(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
    messageId: number,
    output: string,
    options?: ChatDownloadOptions,
  ): Promise<void> {
    await this._guardInitialized();
    const conv = this.getChannelOrConversationId(channelOrConversationId);
    const args = { ...options, ...conv, messageId, output };
    const res = await this._runApiCommand({ apiName: "chat", method: "download", options: args });
    if (!res) throw new Error("Keybase chat download returned nothing");
  }

  public async react(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
    messageId: number,
    reaction: string,
  ): Promise<chat1.SendRes> {
    await this._guardInitialized();
    const conv = this.getChannelOrConversationId(channelOrConversationId);
    const args = { ...conv, messageId, message: { body: reaction } };
    const res = await this._runApiCommand({ apiName: "chat", method: "reaction", options: args });
    if (!res) throw new Error("Keybase chat react returned nothing.");
    return res;
  }

  public async delete(
    channelOrConversationId: chat1.ChatChannel | chat1.ConvIDStr,
    messageId: number,
  ): Promise<void> {
    await this._guardInitialized();
    const conv = this.getChannelOrConversationId(channelOrConversationId);
    const args = { ...conv, messageId };
    const res = await this._runApiCommand({ apiName: "chat", method: "delete", options: args });
    if (!res) throw new Error("Keybase chat delete returned nothing.");
  }

  public async getUnfurlSettings(): Promise<chat1.UnfurlSettings> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "getunfurlsettings",
      options: {},
    });
    if (!res) throw new Error("Keybase chat get unfurl mode returned nothing.");
    return res;
  }

  public async setUnfurlSettings(mode: chat1.UnfurlSettings): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "setunfurlsettings",
      options: mode,
    });
    if (!res) throw new Error("Keybase chat set unfurl mode returned nothing.");
  }

  public async getDeviceInfo(username: string): Promise<chat1.GetDeviceInfoRes> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "getdeviceinfo",
      options: { username },
    });
    if (!res) throw new Error("Keybase chat get device info returned nothing.");
    return res;
  }

  public async loadFlip(
    conversationID: string,
    flipConversationID: string,
    messageID: number,
    gameID: string,
  ): Promise<chat1.UICoinFlipStatus> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "loadflip",
      options: formatAPIObjectInput(
        { conversationID, flipConversationID, msg_id: messageID, gameID },
        "chat",
      ),
      timeout: 2000,
    });
    if (!res) throw new Error("Keybase chat load flip returned nothing.");
    return res.status;
  }

  public async advertiseCommands(advertisement: Advertisement): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "advertisecommands",
      options: advertisement,
    });
    if (!res) throw new Error("Keybase chat advertise commands returned nothing.");
  }

  public async clearCommands(): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "chat", method: "clearcommands" });
    if (!res) throw new Error("Keybase chat clear commands returned nothing.");
  }

  public async addResetConvMember(
    param: chat1.ResetConvMemberAPI,
  ): Promise<chat1.GetResetConvMembersRes> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "addresetconvmember",
      options: param,
    });
    if (!res) throw new Error("addResetConvMember returned nothing.");
    return res;
  }

  public async getResetConvMembers(): Promise<chat1.GetResetConvMembersRes> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "chat", method: "getresetconvmembers" });
    if (!res) throw new Error("getResetConvMembers returned nothing.");
    return res;
  }

  public async listCommands(
    lookup: AdvertisementsLookup,
  ): Promise<{ commands: chat1.UserBotCommandOutput[] }> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "chat",
      method: "listcommands",
      options: lookup,
    });
    if (!res) throw new Error("Keybase chat list commands returned nothing.");
    return { commands: res.commands || [] };
  }

  public async watchChannelForNewMessages(
    channel: chat1.ChatChannel,
    onMessage: OnMessage,
    onError?: OnError,
    options?: ListenOptions,
  ): Promise<void> {
    await this._guardInitialized();
    return this._chatListenMessage(onMessage, onError, channel, options);
  }

  public async watchAllChannelsForNewMessages(
    onMessage: OnMessage,
    onError?: OnError,
    options?: ListenOptions,
  ): Promise<void> {
    await this._guardInitialized();
    return this._chatListenMessage(onMessage, onError, undefined, options);
  }

  public async watchForNewConversation(onConv: OnConv, onError?: OnError): Promise<void> {
    await this._guardInitialized();
    return this._chatListenConvs(onConv, onError);
  }

  private _spawnChatListenChild(args: string[], onLine: (line: string) => void): Promise<void> {
    return new Promise((resolve, reject): void => {
      const child = spawn(this._pathToKeybaseBinary(), args);
      this._spawnedProcesses.push(child);
      const cmdSample = `${this._pathToKeybaseBinary()} ${args.join(" ")}`;
      this._adminDebugLogger.info(`beginning listen using ${cmdSample}`);
      const lineReaderStderr = readline.createInterface({ input: child.stderr });
      const stdErrBuffer: string[] = [];
      child.on("error", (err: Error): void => {
        this._adminDebugLogger.error(`got listen error ${err.message}`);
      });
      child.on("exit", (): void => {
        this._adminDebugLogger.info("got listen exit");
      });
      child.on("close", (code: number): void => {
        this._adminDebugLogger.info(`got listen close, code ${code}`);
        if (code) {
          return this._deinitializing ? resolve() : reject(new Error(stdErrBuffer.join("\n")));
        }
        resolve();
      });
      child.on("disconnect", (): void => {
        this._adminDebugLogger.info("got listen disconnect");
      });
      lineReaderStderr.on("line", (line: string): void => {
        stdErrBuffer.push(line);
        this._adminDebugLogger.error(`stderr from listener: ${line}`);
      });
      const lineReaderStdout = readline.createInterface({ input: child.stdout });
      lineReaderStdout.on("line", onLine);
    });
  }

  private _getChatListenArgs(
    channel?: chat1.ChatChannel,
    options?: ListenOptions,
  ): string[] {
    const args = ["chat", "api-listen"];
    if (this.homeDir) {
      args.unshift("--home", this.homeDir);
    }
    if (!options || options.hideExploding !== false) {
      args.push("--hide-exploding");
    }
    if (options?.showLocal === true) {
      args.push("--local");
    }
    if (channel) {
      args.push("--filter-channel", JSON.stringify(formatAPIObjectInput(channel, "chat")));
    }
    return args;
  }

  private _chatListenMessage(
    onMessage: OnMessage,
    onError?: OnError,
    channel?: chat1.ChatChannel,
    options?: ListenOptions,
  ): Promise<void> {
    const args = this._getChatListenArgs(channel, options);
    const onLine = (line: string): void => {
      this._adminDebugLogger.info(`stdout from listener: ${line}`);
      try {
        const messageObject = formatAPIObjectOutput(JSON.parse(line), null);
        if (Object.prototype.hasOwnProperty.call(messageObject, "error")) {
          throw new Error(messageObject.error);
        }
        if (messageObject.type !== "chat" || !messageObject.msg) {
          return;
        }
        const msgNotification: chat1.MsgNotification = messageObject;
        if (msgNotification.msg) {
          if (
            options?.showLocal ||
            (this.username &&
              this.devicename &&
              (msgNotification.msg.sender.username !== this.username.toLowerCase() ||
                msgNotification.msg.sender.deviceName !== this.devicename))
          ) {
            void onMessage(msgNotification.msg);
          }
        }
      } catch (error) {
        if (onError) {
          void onError(error as Error);
        }
      }
    };
    this._adminDebugLogger.info(
      `spawningChatListenChild on channel=${JSON.stringify(channel ?? "ALL")}`,
    );
    return this._spawnChatListenChild(args, onLine);
  }

  private _chatListenConvs(onConv: OnConv, onError?: OnError): Promise<void> {
    const args = this._getChatListenArgs();
    args.push("--convs");
    this._adminDebugLogger.info("spawningChatListenChild for convs");
    return this._spawnChatListenChild(args, (line: string) => {
      this._adminDebugLogger.info(`stdout from listener: ${line}`);
      try {
        const messageObject = formatAPIObjectOutput(JSON.parse(line), null);
        if (Object.prototype.hasOwnProperty.call(messageObject, "error")) {
          throw new Error(messageObject.error);
        }
        if (messageObject.type !== "chat_conv" || !messageObject.conv) {
          return;
        }
        const convNotification: chat1.ConvNotification = messageObject;
        if (convNotification.conv) {
          void onConv(convNotification.conv);
        }
      } catch (error) {
        if (onError) {
          void onError(error as Error);
        }
      }
    });
  }
}

export default Chat;

import ClientBase from "../client-base/index.js";
import { keybaseExec } from "../utils/index.js";

interface ApiCallArg {
  endpoint: string;
  arg?: Record<string, string>;
}

/** A module of various helper functions for your bot. */
class Helpers extends ClientBase {
  public async rawApiCall(arg: ApiCallArg): Promise<any> {
    await this._guardInitialized();
    const args: string[] = [arg.endpoint];
    if (arg.arg) {
      for (const k of Object.keys(arg.arg)) {
        args.unshift("-a", `${k}=${arg.arg[k]}`);
      }
    }
    args.unshift("apicall");
    return keybaseExec(this._workingDir, this.homeDir, args, { json: true });
  }

  public async ping(): Promise<any> {
    await this._guardInitialized();
    return keybaseExec(this._workingDir, this.homeDir, ["ping"]);
  }
}

export default Helpers;

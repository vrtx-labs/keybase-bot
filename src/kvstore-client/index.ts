import { ErrorWithCode, default as ClientBase } from "../client-base/index.js";
import type * as keybase1 from "../types/keybase1/index.js";

export enum KVStoreErrorType {
  Other = 0,
  WrongRevision = 2760,
  BadGeneration = 2761,
  NotFound = 2762,
}

export const ErrorIsWrongRevision = (error: ErrorWithCode): boolean =>
  error.code === KVStoreErrorType.WrongRevision;
export const ErrorIsBadGeneration = (error: ErrorWithCode): boolean =>
  error.code === KVStoreErrorType.BadGeneration;
export const ErrorIsNotFound = (error: ErrorWithCode): boolean =>
  error.code === KVStoreErrorType.NotFound;

const entryValueIsSet = (entryValue: string | null | undefined): boolean =>
  entryValue !== "" && entryValue !== null && entryValue !== undefined;

/** The kvstore module of your Keybase bot. */
class KVStore extends ClientBase {
  private normalizeTeam(team: string | undefined): string {
    if (!this.username) return team ?? "";
    if (!team || team === this.username) return `${this.username},${this.username}`;
    return team;
  }

  public async listNamespaces(
    team: string | undefined,
  ): Promise<keybase1.KVListNamespaceResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "kvstore",
      method: "list",
      options: { team: this.normalizeTeam(team) },
    });
    if (!res) throw new Error("Keybase kvstore list returned nothing.");
    return res;
  }

  public async listEntryKeys(
    team: string | undefined,
    namespace: string,
  ): Promise<keybase1.KVListEntryResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "kvstore",
      method: "list",
      options: { namespace, team: this.normalizeTeam(team) },
    });
    if (!res) throw new Error("Keybase kvstore list returned nothing.");
    return res;
  }

  public async get(
    team: string | undefined,
    namespace: string,
    entryKey: string,
  ): Promise<keybase1.KVGetResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "kvstore",
      method: "get",
      options: { entrykey: entryKey, namespace, team: this.normalizeTeam(team) },
    });
    if (!res) throw new Error("Keybase kvstore get returned nothing.");
    return res;
  }

  public async put(
    team: string | undefined,
    namespace: string,
    entryKey: string,
    entryValue: string,
    revision?: number,
  ): Promise<keybase1.KVPutResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "kvstore",
      method: "put",
      options: {
        entrykey: entryKey,
        entryvalue: entryValue,
        namespace,
        revision,
        team: this.normalizeTeam(team),
      },
    });
    if (!res) throw new Error("Keybase kvstore put returned nothing.");
    return res;
  }

  public async delete(
    team: string | undefined,
    namespace: string,
    entryKey: string,
    revision?: number,
  ): Promise<keybase1.KVDeleteEntryResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "kvstore",
      method: "del",
      options: { entrykey: entryKey, namespace, revision, team: this.normalizeTeam(team) },
    });
    if (!res) throw new Error("Keybase kvstore delete returned nothing.");
    return res;
  }

  public isDeleted(res: keybase1.KVGetResult): boolean {
    return res.revision > 0 && !entryValueIsSet(res.entryValue);
  }

  public isPresent(res: keybase1.KVGetResult): boolean {
    return res.revision > 0 && entryValueIsSet(res.entryValue);
  }
}

export default KVStore;

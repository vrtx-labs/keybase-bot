import ClientBase from "../client-base/index.js";
import type * as stellar1 from "../types/stellar1/index.js";

/** The wallet module of your Keybase bot. */
class Wallet extends ClientBase {
  public async balances(): Promise<stellar1.OwnAccountCLILocal[]> {
    await this._guardInitialized();
    const res = await this._runApiCommand({ apiName: "wallet", method: "balances" });
    if (!res) throw new Error("Keybase wallet balances returned nothing.");
    return res || [];
  }

  public async history(accountId: stellar1.AccountID): Promise<stellar1.PaymentCLILocal[]> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "wallet",
      method: "history",
      options: { accountId },
    });
    if (!res) throw new Error("Keybase wallet history returned nothing.");
    return res.map(
      (item: stellar1.PaymentOrErrorCLILocal): stellar1.PaymentCLILocal => item?.payment!,
    );
  }

  public async details(transactionId: stellar1.TransactionID): Promise<stellar1.PaymentCLILocal> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "wallet",
      method: "details",
      options: { txid: transactionId },
    });
    if (!res) throw new Error("Keybase wallet details returned nothing.");
    return res;
  }

  public async lookup(name: string): Promise<{ accountId: stellar1.AccountID; username: string }> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "wallet",
      method: "lookup",
      options: { name },
    });
    if (!res) throw new Error("Keybase wallet lookup returned nothing.");
    return res;
  }

  public async send(
    recipient: string,
    amount: string,
    currency?: string,
    message?: string,
  ): Promise<stellar1.PaymentCLILocal> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "wallet",
      method: "send",
      options: { recipient, amount, currency, message },
    });
    if (!res) throw new Error("Keybase wallet send returned nothing.");
    return res;
  }

  public async batch(
    batchId: string,
    payments: stellar1.BatchPaymentArg[],
    timeoutSec?: number,
  ): Promise<stellar1.BatchResultLocal> {
    await this._guardInitialized();
    const options: object =
      typeof timeoutSec !== "undefined"
        ? { batchId, payments, timeout: timeoutSec }
        : { batchId, payments };
    const res = await this._runApiCommand({ apiName: "wallet", method: "batch", options });
    if (!res) throw new Error("Keybase wallet batch returned nothing.");
    return res;
  }

  public async cancel(transactionId: stellar1.TransactionID): Promise<void> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "wallet",
      method: "cancel",
      options: { txid: transactionId },
    });
    if (!res) throw new Error("Keybase wallet cancel returned nothing.");
  }
}

export default Wallet;

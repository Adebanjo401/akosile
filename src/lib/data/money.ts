import { getDb } from "@/lib/db";
import {
  formatMoney,
  getCurrency,
  toBaseMinor,
  toMinorUnits,
} from "@/lib/money/currencies";
import { enqueueDelete, enqueueUpsert } from "@/lib/sync/engine";
import { createId, nowIso } from "@/lib/utils";
import type {
  Account,
  CurrencyCode,
  ExchangeRate,
  Transaction,
  TransactionSource,
  TransactionType,
  Transfer,
} from "@/types";

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export async function getRateToBase(
  userId: string,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
): Promise<ExchangeRate | null> {
  if (currency === baseCurrency) {
    return {
      id: "identity",
      userId,
      currency,
      rateToBase: 1,
      source: "manual",
      asOf: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  const db = getDb();
  return (
    (await db.exchangeRates
      .where("[userId+currency]")
      .equals([userId, currency])
      .first()) ?? null
  );
}

export async function saveManualRate(input: {
  userId: string;
  currency: CurrencyCode;
  rateToBase: number;
}): Promise<ExchangeRate> {
  if (input.rateToBase <= 0) {
    throw new MoneyError("Enter an exchange rate greater than 0.");
  }
  const db = getDb();
  const existing = await db.exchangeRates
    .where("[userId+currency]")
    .equals([input.userId, input.currency])
    .first();
  const stamp = nowIso();
  const rate: ExchangeRate = {
    id: existing?.id ?? createId(),
    userId: input.userId,
    currency: input.currency,
    rateToBase: input.rateToBase,
    source: "manual",
    asOf: stamp,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  await db.exchangeRates.put(rate);
  await enqueueUpsert("exchangeRates", rate.id, rate);
  return rate;
}

export async function createTransaction(input: {
  userId: string;
  type: TransactionType;
  accountId: string;
  amount: number;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  rateToBase?: number;
  categoryId?: string | null;
  date?: string;
  note?: string;
  source?: TransactionSource;
}): Promise<Transaction> {
  if (!(input.amount > 0)) {
    throw new MoneyError("Enter an amount greater than 0.");
  }

  const db = getDb();
  const account = await db.accounts.get(input.accountId);
  if (!account || account.userId !== input.userId) {
    throw new MoneyError("Choose a valid account.");
  }

  const currency = input.currency || account.currency;
  const meta = getCurrency(currency);
  // Round to currency minor units
  const amountMinor = toMinorUnits(input.amount, currency);
  if (amountMinor <= 0) {
    throw new MoneyError(
      `Enter an amount of at least ${1 / 10 ** meta.minorUnits} ${currency}.`,
    );
  }

  let rateToBase = input.rateToBase;
  if (rateToBase == null) {
    const stored = await getRateToBase(
      input.userId,
      currency,
      input.baseCurrency,
    );
    if (!stored) {
      throw new MoneyError(
        `Enter an exchange rate for ${currency} to save this entry.`,
      );
    }
    rateToBase = stored.rateToBase;
  }

  const stamp = nowIso();
  const tx: Transaction = {
    id: createId(),
    userId: input.userId,
    type: input.type,
    accountId: input.accountId,
    amountMinor,
    currency,
    rateToBase,
    amountBaseMinor: toBaseMinor(
      amountMinor,
      currency,
      input.baseCurrency,
      rateToBase,
    ),
    categoryId: input.categoryId ?? null,
    tags: [],
    date: input.date ?? stamp.slice(0, 10),
    note: input.note ?? null,
    recurringId: null,
    status: "cleared",
    source: input.source ?? "manual",
    dueDate: null,
    createdAt: stamp,
    updatedAt: stamp,
  };

  await db.transactions.put(tx);
  await enqueueUpsert("transactions", tx.id, tx);
  return tx;
}

export async function deleteTransaction(
  userId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  const tx = await db.transactions.get(id);
  if (!tx || tx.userId !== userId) return;

  const linked = await db.householdItems
    .where("[userId+transactionId]")
    .equals([userId, id])
    .toArray();
  const stamp = nowIso();
  for (const item of linked) {
    const updated = {
      ...item,
      transactionId: null,
      updatedAt: stamp,
    };
    await db.householdItems.put(updated);
    await enqueueUpsert("householdItems", updated.id, updated, { flush: false });
  }

  await db.transactions.delete(id);
  await enqueueDelete("transactions", id);
}

export async function createTransfer(input: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  toAmount?: number;
  rate?: number;
  baseCurrency: CurrencyCode;
  date?: string;
  note?: string;
}): Promise<Transfer> {
  const db = getDb();
  const from = await db.accounts.get(input.fromAccountId);
  const to = await db.accounts.get(input.toAccountId);
  if (!from || !to || from.userId !== input.userId || to.userId !== input.userId) {
    throw new MoneyError("Choose valid accounts.");
  }
  if (from.id === to.id) {
    throw new MoneyError("Pick two different accounts.");
  }
  if (!(input.fromAmount > 0)) {
    throw new MoneyError("Enter an amount greater than 0.");
  }

  const fromAmountMinor = toMinorUnits(input.fromAmount, from.currency);
  let toAmountMinor: number;
  let rate: number;

  if (from.currency === to.currency) {
    rate = 1;
    toAmountMinor = fromAmountMinor;
  } else {
    if (input.toAmount != null && input.toAmount > 0) {
      toAmountMinor = toMinorUnits(input.toAmount, to.currency);
      rate = input.toAmount / input.fromAmount;
    } else if (input.rate != null && input.rate > 0) {
      rate = input.rate;
      toAmountMinor = toMinorUnits(input.fromAmount * rate, to.currency);
    } else {
      throw new MoneyError(
        `Enter a rate or destination amount for ${from.currency} to ${to.currency}.`,
      );
    }
  }

  const stamp = nowIso();
  const transfer: Transfer = {
    id: createId(),
    userId: input.userId,
    fromAccountId: from.id,
    toAccountId: to.id,
    fromAmountMinor,
    toAmountMinor,
    fromCurrency: from.currency,
    toCurrency: to.currency,
    rate,
    date: input.date ?? stamp.slice(0, 10),
    note: input.note ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.transfers.put(transfer);
  await enqueueUpsert("transfers", transfer.id, transfer);
  return transfer;
}

export async function createAccount(input: {
  userId: string;
  name: string;
  type: Account["type"];
  currency: CurrencyCode;
  openingBalance: number;
}): Promise<Account> {
  const stamp = nowIso();
  const account: Account = {
    id: createId(),
    userId: input.userId,
    name: input.name.trim() || "Account",
    type: input.type,
    currency: input.currency,
    openingBalanceMinor: toMinorUnits(input.openingBalance, input.currency),
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const db = getDb();
  await db.accounts.put(account);
  await enqueueUpsert("accounts", account.id, account);
  return account;
}

export async function getAccountBalanceMinor(
  account: Account,
): Promise<number> {
  const db = getDb();
  const txs = await db.transactions
    .where({ accountId: account.id })
    .toArray();
  const transfers = await db.transfers
    .filter(
      (t) =>
        t.fromAccountId === account.id || t.toAccountId === account.id,
    )
    .toArray();

  let balance = account.openingBalanceMinor;
  for (const tx of txs) {
    if (tx.status !== "cleared") continue;
    balance += tx.type === "income" ? tx.amountMinor : -tx.amountMinor;
  }
  for (const tr of transfers) {
    if (tr.fromAccountId === account.id) balance -= tr.fromAmountMinor;
    if (tr.toAccountId === account.id) balance += tr.toAmountMinor;
  }
  return balance;
}

export async function getTodayMoneySnapshot(
  userId: string,
  baseCurrency: CurrencyCode,
  day = nowIso().slice(0, 10),
): Promise<{ spentBaseMinor: number; incomeBaseMinor: number }> {
  const db = getDb();
  const txs = await db.transactions.where({ userId }).toArray();
  let spentBaseMinor = 0;
  let incomeBaseMinor = 0;
  for (const tx of txs) {
    if (tx.date !== day || tx.status !== "cleared") continue;
    if (tx.type === "expense") spentBaseMinor += tx.amountBaseMinor;
    else incomeBaseMinor += tx.amountBaseMinor;
  }
  return { spentBaseMinor, incomeBaseMinor };
}

export { formatMoney };

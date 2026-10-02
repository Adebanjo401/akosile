import type { CurrencyCode } from "@/types";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  minorUnits: number;
}

/** ISO 4217 subset required for MVP (MC-3) */
export const CURRENCIES: Record<string, CurrencyMeta> = {
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "₦", minorUnits: 2 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", minorUnits: 2 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", minorUnits: 2 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2 },
  GHS: { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", minorUnits: 2 },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", minorUnits: 2 },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", minorUnits: 2 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", minorUnits: 2 },
  AED: { code: "AED", name: "UAE Dirham", symbol: "د.إ", minorUnits: 2 },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "¥", minorUnits: 2 },
  XOF: { code: "XOF", name: "West African CFA", symbol: "CFA", minorUnits: 0 },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", minorUnits: 0 },
};

export const DEFAULT_ENABLED_CURRENCIES: CurrencyCode[] = [
  "NGN",
  "USD",
  "GBP",
  "EUR",
];

export function getCurrency(code: CurrencyCode): CurrencyMeta {
  return (
    CURRENCIES[code] ?? {
      code,
      name: code,
      symbol: code,
      minorUnits: 2,
    }
  );
}

/** Convert a decimal display amount to minor units (integer). */
export function toMinorUnits(amount: number, currency: CurrencyCode): number {
  const { minorUnits } = getCurrency(currency);
  const factor = 10 ** minorUnits;
  return Math.round(amount * factor);
}

/** Convert minor units to a decimal display amount. */
export function fromMinorUnits(
  amountMinor: number,
  currency: CurrencyCode,
): number {
  const { minorUnits } = getCurrency(currency);
  const factor = 10 ** minorUnits;
  return amountMinor / factor;
}

/**
 * Convert foreign minor units to base minor units using a rate:
 * rate = how many base currency units per 1 foreign unit (e.g. 1500 NGN per 1 USD).
 */
export function toBaseMinor(
  amountMinor: number,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rateToBase: number,
): number {
  if (currency === baseCurrency) return amountMinor;
  const foreign = fromMinorUnits(amountMinor, currency);
  const baseMajor = foreign * rateToBase;
  return toMinorUnits(baseMajor, baseCurrency);
}

export function formatMoney(
  amountMinor: number,
  currency: CurrencyCode,
  locale = "en-NG",
): string {
  const meta = getCurrency(currency);
  const major = fromMinorUnits(amountMinor, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: meta.code,
      minimumFractionDigits: meta.minorUnits,
      maximumFractionDigits: meta.minorUnits,
    }).format(major);
  } catch {
    return `${meta.symbol}${major.toFixed(meta.minorUnits)}`;
  }
}

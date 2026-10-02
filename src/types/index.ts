/** Shared domain types for Akosile */

export type CurrencyCode =
  | "NGN"
  | "USD"
  | "GBP"
  | "EUR"
  | "GHS"
  | "KES"
  | "ZAR"
  | "CAD"
  | "AED"
  | "CNY"
  | "XOF"
  | "JPY"
  | string;

export type UserRole = "user" | "admin";

export type CategoryModule =
  | "money-expense"
  | "money-income"
  | "task"
  | "health"
  | "household";

export type AccountType =
  | "cash"
  | "bank"
  | "mobile_money"
  | "card"
  | "savings"
  | "wallet";

export type TransactionType = "expense" | "income";

export type TransactionStatus = "cleared" | "upcoming";

export type TransactionSource = "manual" | "expense";

export type TaskStatus = "pending" | "completed" | "cancelled";

export type ReminderStatus =
  | "pending"
  | "fired"
  | "missed"
  | "done"
  | "snoozed";

export type ReminderChannel = "in_app" | "push" | "email";

export type HealthLogType =
  | "water"
  | "sleep"
  | "steps"
  | "exercise"
  | "workout"
  | "food";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type HouseholdKind = "grocery" | "repair" | "other";

export type HouseholdStatus = "needed" | "done" | "cancelled";

export type RecurrenceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  /** 0=Sun … 6=Sat for weekly */
  byWeekday?: number[];
  /** Day of month, or -1 for last day */
  byMonthDay?: number;
  endDate?: string | null;
}

export interface Profile {
  id: string;
  name: string;
  email?: string | null;
  timezone: string;
  locale: string;
  baseCurrency: CurrencyCode;
  firstDayOfWeek: 0 | 1;
  role: UserRole;
  modules: {
    schedule: boolean;
    money: boolean;
    health: boolean;
    household: boolean;
  };
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  theme: "light" | "dark" | "system";
  waterUnit: "cups" | "ml";
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  module: CategoryModule;
  parentId?: string | null;
  color: string;
  icon: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalanceMinor: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  accountId: string;
  amountMinor: number;
  currency: CurrencyCode;
  rateToBase: number;
  amountBaseMinor: number;
  categoryId?: string | null;
  tags: string[];
  date: string;
  note?: string | null;
  recurringId?: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmountMinor: number;
  toAmountMinor: number;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  date: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRate {
  id: string;
  userId: string;
  currency: CurrencyCode;
  rateToBase: number;
  source: "manual" | "automatic";
  asOf: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  categoryId?: string | null;
  dueAt?: string | null;
  recurrence: RecurrenceRule;
  seriesId?: string | null;
  status: TaskStatus;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  itemType: "task" | "transaction" | "medication" | "health";
  itemId: string;
  /** Absolute fire time ISO, or null if offset-based */
  fireAt: string;
  offsetMinutes?: number | null;
  channel: ReminderChannel;
  status: ReminderStatus;
  snoozeUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthLog {
  id: string;
  userId: string;
  type: HealthLogType;
  value: number;
  unit: string;
  loggedAt: string;
  note?: string | null;
  /** Workout name or food description. */
  title?: string | null;
  meal?: MealSlot | null;
  createdAt: string;
  updatedAt: string;
}

/** Groceries, repairs and other household needs that often become expenses. */
export interface HouseholdItem {
  id: string;
  userId: string;
  title: string;
  kind: HouseholdKind;
  status: HouseholdStatus;
  estimatedAmountMinor: number | null;
  currency: CurrencyCode | null;
  categoryId: string | null;
  note: string | null;
  transactionId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Monthly category cap in the user's base currency. */
export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  /** First calendar day of the month as `yyyy-MM-01`. */
  periodStart: string;
  amountBaseMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxEntry {
  id: string;
  table: string;
  recordId: string;
  operation: "upsert" | "delete";
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
}

export interface SyncMeta {
  id: string;
  lastPulledAt?: string | null;
  lastPushedAt?: string | null;
}

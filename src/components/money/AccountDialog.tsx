"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAccount } from "@/lib/data/money";
import { CURRENCIES } from "@/lib/money/currencies";
import type { AccountType, CurrencyCode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Card" },
  { value: "savings", label: "Savings" },
  { value: "wallet", label: "Wallet" },
];

export function AddAccountDialog({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: CurrencyCode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [opening, setOpening] = useState("0");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a name for this account.");
      return;
    }
    try {
      await createAccount({
        userId,
        name,
        type,
        currency,
        openingBalance: Number(opening) || 0,
      });
      toast.success("Account added");
      setName("");
      setOpening("0");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus />
          Add account
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>
            Each account holds one currency. Spending is logged against these.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name" htmlFor="acct-name" error={error}>
            <Input
              id="acct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GTBank current"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={type}
                onValueChange={(v) => setType(v as AccountType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CURRENCIES).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Opening balance" htmlFor="acct-opening">
            <Input
              id="acct-opening"
              inputMode="decimal"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()}>
            Save account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

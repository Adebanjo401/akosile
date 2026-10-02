"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { saveManualRate } from "@/lib/data/money";
import { CURRENCIES } from "@/lib/money/currencies";
import type { CurrencyCode } from "@/types";
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

export function SetRateDialog({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: CurrencyCode;
}) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(
    baseCurrency === "USD" ? "NGN" : "USD",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await saveManualRate({
        userId,
        currency,
        rateToBase: Number(value),
      });
      toast.success("Rate saved");
      setValue("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save rate.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus />
          Set rate
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exchange rate</DialogTitle>
          <DialogDescription>
            How many {baseCurrency} equal one unit of the other currency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Currency">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CURRENCIES)
                  .filter((c) => c.code !== baseCurrency)
                  .map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={`Rate to ${baseCurrency}`}
            htmlFor="rate-value"
            error={error}
            hint={`1 ${currency} = ? ${baseCurrency}`}
          >
            <Input
              id="rate-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 1500"
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
            Save rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

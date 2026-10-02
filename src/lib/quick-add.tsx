"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { QuickAddSheet, type QuickAddTab } from "@/components/QuickAddSheet";

interface QuickAddContextValue {
  /**
   * Open the capture sheet scoped to the given tabs. The first tab is active,
   * and the tab switcher is hidden when only one is passed so each module's
   * add button leads straight to the right form.
   */
  open: (tabs: QuickAddTab[]) => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<QuickAddTab[] | null>(null);

  const open = useCallback((next: QuickAddTab[]) => {
    if (next.length === 0) return;
    setTabs(next);
  }, []);

  const value = useMemo<QuickAddContextValue>(() => ({ open }), [open]);

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <QuickAddSheet tabs={tabs} onClose={() => setTabs(null)} />
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd(): QuickAddContextValue {
  const context = useContext(QuickAddContext);
  if (!context) {
    throw new Error("useQuickAdd must be used inside a QuickAddProvider.");
  }
  return context;
}

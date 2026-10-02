"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  bindAuthSession,
  ensureLocalProfile,
  getOrCreateLocalUserId,
} from "@/lib/data/bootstrap";
import { getDb, openDb } from "@/lib/db";
import { createBrowserClient } from "@/lib/supabase/client";
import { flushOutbox, startSyncListeners, syncNow } from "@/lib/sync/engine";
import { markMissedReminders } from "@/lib/data/tasks";
import { isSupabaseConfigured } from "@/lib/utils";
import type { Profile } from "@/types";

interface AppContextValue {
  ready: boolean;
  bootError: string | null;
  profile: Profile | null;
  userId: string;
  online: boolean;
  supabaseEnabled: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [online, setOnline] = useState(true);

  const liveProfile = useLiveQuery(async () => {
    if (!userId || !ready) return null;
    return getDb().profiles.get(userId);
  }, [userId, ready]);

  useEffect(() => {
    if (liveProfile) setProfile(liveProfile);
  }, [liveProfile]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await openDb();
        const id = getOrCreateLocalUserId();
        if (cancelled) return;
        setUserId(id);

        const p = await ensureLocalProfile({ id });
        if (cancelled) return;

        setProfile(p);
        await markMissedReminders(id);
        setReady(true);
        void flushOutbox();

        if (isSupabaseConfigured()) {
          const supabase = createBrowserClient();
          const {
            data: { session },
          } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
          if (session?.user && !cancelled) {
            const bound = await bindAuthSession(
              session.user.id,
              session.user.email,
            );
            if (!cancelled) {
              setUserId(bound);
              const boundProfile = await getDb().profiles.get(bound);
              if (boundProfile) setProfile(boundProfile);
              await markMissedReminders(bound);
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        setBootError(
          err instanceof Error
            ? err.message
            : "Akosile could not open its local storage.",
        );
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => {
      setOnline(true);
      void syncNow();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const stop = startSyncListeners();

    const supabase = isSupabaseConfigured() ? createBrowserClient() : null;
    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      void bindAuthSession(session.user.id, session.user.email).then(
        async (bound) => {
          setUserId(bound);
          const boundProfile = await getDb().profiles.get(bound);
          if (boundProfile) setProfile(boundProfile);
        },
      );
    }) ?? { data: { subscription: { unsubscribe() {} } } };

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      stop();
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const p = await getDb().profiles.get(userId);
    if (p) setProfile(p);
  }, [userId]);

  const value = useMemo(
    () => ({
      ready,
      bootError,
      profile,
      userId,
      online,
      supabaseEnabled: isSupabaseConfigured(),
      refreshProfile,
      setProfile,
    }),
    [ready, bootError, profile, userId, online, refreshProfile],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

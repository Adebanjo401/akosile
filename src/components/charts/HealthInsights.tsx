"use client";

import { useMemo } from "react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HealthLog } from "@/types";

export function HealthInsights({
  logs,
  from,
  to,
}: {
  logs: HealthLog[];
  from?: Date;
  to?: Date;
}) {
  const week = useMemo(() => {
    const rangeEnd = to ?? new Date();
    const rangeStart = from ?? subDays(rangeEnd, 6);
    const span = eachDayOfInterval({
      start: rangeStart,
      end: rangeEnd,
    });
    const days = span.length > 14 ? span.slice(-14) : span;
    return days.map((day) => {
      const start = day;
      const key = format(start, "yyyy-MM-dd");
      let water = 0;
      let sleep = 0;
      let workout = 0;
      let meals = 0;
      for (const log of logs) {
        if (format(parseISO(log.loggedAt), "yyyy-MM-dd") !== key) continue;
        if (log.type === "water") water += Number(log.value);
        if (log.type === "sleep") sleep = Number(log.value);
        if (log.type === "workout" || log.type === "exercise") {
          workout += Number(log.value);
        }
        if (log.type === "food") meals += Number(log.value);
      }
      return {
        label: format(day, "EEE"),
        water,
        sleep,
        workout,
        meals,
      };
    });
  }, [logs, from, to]);

  const hasWater = week.some((d) => d.water > 0);
  const hasSleep = week.some((d) => d.sleep > 0);
  const hasWorkout = week.some((d) => d.workout > 0);

  if (!hasWater && !hasSleep && !hasWorkout) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hasWater && (
        <ChartCard title="Water" caption="Logged each day">
          <BarChart data={week}>
            <CartesianGrid stroke="#dde5df" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#66736a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#66736a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              formatter={(value) => [`${value} cups`, "Water"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #dde5df",
                fontSize: 12,
              }}
            />
            <Bar dataKey="water" fill="#14532d" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
      )}

      {hasSleep && (
        <ChartCard title="Sleep" caption="Hours logged">
          <LineChart data={week}>
            <CartesianGrid stroke="#dde5df" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#66736a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#66736a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
              domain={[0, 12]}
            />
            <Tooltip
              formatter={(value) => [`${value} h`, "Sleep"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #dde5df",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="sleep"
              stroke="#c89b3c"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#c89b3c" }}
            />
          </LineChart>
        </ChartCard>
      )}

      {hasWorkout && (
        <ChartCard
          title="Workouts"
          caption="Minutes of movement"
          className="sm:col-span-2"
        >
          <BarChart data={week}>
            <CartesianGrid stroke="#dde5df" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#66736a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#66736a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              formatter={(value) => [`${value} min`, "Workout"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #dde5df",
                fontSize: 12,
              }}
            />
            <Bar dataKey="workout" fill="#0f3d25" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption: string;
  children: React.ReactElement;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className ?? ""}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{caption}</p>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

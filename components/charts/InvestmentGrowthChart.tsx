"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { useFormatter } from "next-intl";

export type GrowthPoint = { date: string; balance: number };

const SERIES_COLOR = "#7c3aed"; // matches the Investments pocket accent

export function InvestmentGrowthChart({ data }: { data: GrowthPoint[] }) {
  const format = useFormatter();

  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-foreground/72">
        Not enough history yet — check back after your first deposit or market update.
      </p>
    );
  }

  const lastIndex = data.length - 1;

  return (
    <div className="h-64 w-full" role="img" aria-label="Investment balance over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="investmentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.1} />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.5 }}
            tickFormatter={(value: string) =>
              format.dateTime(new Date(value), {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })
            }
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.5 }}
            tickFormatter={(value: number) => `₪${Math.round(value)}`}
          />
          <Tooltip
            formatter={(value) => [`₪${Number(value).toFixed(2)}`, "Balance"]}
            labelFormatter={(value) =>
              value
                ? format.dateTime(new Date(String(value)), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })
                : ""
            }
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill="url(#investmentFill)"
            dot={(props: { index?: number; cx?: number; cy?: number }) =>
              props.index === lastIndex ? (
                <Dot
                  key="end-dot"
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill={SERIES_COLOR}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ) : (
                <g key={`dot-${props.index}`} />
              )
            }
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

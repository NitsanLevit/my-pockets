import type { GrowthPoint } from "@/components/charts/InvestmentGrowthChart";

type Tx = { amount: number; created_at: string; status: string };

/** Replays completed investments-pocket transactions in order to produce a
 * running balance-over-time series for the growth chart. */
export function buildGrowthSeries(transactions: Tx[]): GrowthPoint[] {
  const ordered = [...transactions]
    .filter((t) => t.status === "completed")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  let running = 0;
  const points: GrowthPoint[] = [{ date: ordered[0]?.created_at ?? "", balance: 0 }];

  for (const tx of ordered) {
    running += tx.amount;
    points.push({ date: tx.created_at, balance: running });
  }

  return points.filter((p) => p.date);
}

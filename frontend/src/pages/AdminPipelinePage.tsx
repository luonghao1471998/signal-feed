import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPipelineStatus } from "@/services/adminService";
import { Button } from "@/components/ui/button";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";

const AdminPipelinePage: React.FC = () => {
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [submitted, setSubmitted] = React.useState({ startDate: "", endDate: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "pipeline", "status", submitted.startDate, submitted.endDate],
    queryFn: () => fetchPipelineStatus({
      startDate: submitted.startDate || undefined,
      endDate: submitted.endDate || undefined,
    }),
  });

  const card =
    "rounded-xl border border-slate-200/85 bg-gradient-to-br from-white to-slate-50/25 p-4 shadow-md shadow-slate-950/[0.08] ring-1 ring-slate-500/[0.05]";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pipeline monitor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Metrics theo ngày (UTC) — last crawl proxy qua{" "}
          <code className="rounded-md border border-slate-200/70 bg-slate-50/80 px-1.5 py-0.5 font-mono text-xs text-slate-900">
            max(last_crawled_at)
          </code>
          .
        </p>
      </div>
      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/85 bg-white/95 p-4 shadow-md shadow-slate-950/[0.09] ring-1 ring-slate-500/[0.06] md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({ startDate, endDate });
        }}
      >
        <AdminSearchDateField value={startDate} onChange={setStartDate} placeholder="Start Time" />
        <AdminSearchDateField value={endDate} onChange={setEndDate} placeholder="End Time" />
        <Button
          type="submit"
          className="bg-gradient-to-r from-slate-600 to-slate-600 text-white shadow-md shadow-slate-600/25 hover:from-slate-500 hover:to-slate-500"
        >
          Search
        </Button>
      </form>

      {isLoading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {error && (
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Lỗi tải dữ liệu"}</p>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Last crawl (proxy)</p>
            <p className="mt-1 break-all text-base text-slate-900">{data.last_run_timestamp ?? "—"}</p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Tweets (hôm nay)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{data.tweets_fetched_count}</p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Signals (hôm nay)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{data.signals_created_count}</p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Error rate (placeholder)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{data.error_rate}</p>
          </div>
        </div>
      )}

      {data && data.per_category_signal_volume.length > 0 && (
        <div className={card}>
          <h2 className="text-base font-semibold text-slate-900">Volume theo category (signals hôm nay)</h2>
          <ul className="mt-3 space-y-2">
            {data.per_category_signal_volume.map((row) => (
              <li
                key={row.category_id}
                className="flex justify-between border-b border-slate-100/50 py-2 text-sm last:border-0"
              >
                <span className="text-slate-900">{row.category_name}</span>
                <span className="font-medium tabular-nums text-slate-600/90">{row.signal_count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminPipelinePage;

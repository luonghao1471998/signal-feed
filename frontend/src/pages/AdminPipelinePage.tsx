import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPipelineStatus } from "@/services/adminService";
import { Button } from "@/components/ui/button";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";

const AdminPipelinePage: React.FC = () => {
  const [selectedDate, setSelectedDate] = React.useState("");
  const [submittedDate, setSubmittedDate] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "pipeline", "status", submittedDate],
    queryFn: () => fetchPipelineStatus({
      startDate: submittedDate || undefined,
      endDate: submittedDate || undefined,
    }),
  });

  const card =
    "rounded-xl border border-slate-200/85 bg-gradient-to-br from-white to-slate-50/25 p-4 shadow-md shadow-slate-950/[0.08] ring-1 ring-slate-500/[0.05]";

  const lastRun = data?.last_run_timestamp ? new Date(data.last_run_timestamp) : null;
  const hasValidLastRun = lastRun !== null && !Number.isNaN(lastRun.getTime());
  const showStaleAlert = hasValidLastRun
    ? Date.now() - (lastRun as Date).getTime() > 24 * 60 * 60 * 1000
    : true;
  const showHealthyAlert = hasValidLastRun
    && Date.now() - (lastRun as Date).getTime() < 60 * 60 * 1000;
  const showNoActivityAlert = data !== undefined
    && data.tweets_fetched_count === 0
    && data.signals_created_count === 0;
  const hasFilter = submittedDate !== "";

  const lastRunText = React.useMemo(() => {
    if (!hasValidLastRun) {
      return "Never run";
    }

    const elapsedMs = Date.now() - (lastRun as Date).getTime();
    const minutesAgo = Math.floor(elapsedMs / (1000 * 60));

    if (minutesAgo < 1) {
      return "Just now";
    }

    if (minutesAgo < 60) {
      return `${minutesAgo} minutes ago`;
    }

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) {
      return `${hoursAgo} hours ago`;
    }

    const daysAgo = Math.floor(hoursAgo / 24);

    return `${daysAgo} days ago`;
  }, [hasValidLastRun, lastRun]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pipeline monitor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Daily metrics (UTC) — last crawl proxy via{" "}
          <code className="rounded-md border border-slate-200/70 bg-slate-50/80 px-1.5 py-0.5 font-mono text-xs text-slate-900">
            max(last_crawled_at)
          </code>
          .
        </p>
      </div>
      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/85 bg-white/95 p-4 shadow-md shadow-slate-950/[0.09] ring-1 ring-slate-500/[0.06] md:grid-cols-[1.3fr_1fr_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedDate(selectedDate);
        }}
      >
        <AdminSearchDateField value={selectedDate} onChange={setSelectedDate} placeholder="Specific date (YYYY-MM-DD)" />
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-slate-600 to-slate-600 text-white shadow-md shadow-slate-600/25 hover:from-slate-500 hover:to-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
        >Search</Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          className="h-8 px-3 text-xs"
          onClick={() => {
            setSelectedDate("");
            setSubmittedDate("");
          }}
        >
          Reset (Today)
        </Button>
      </form>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && (
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load data."}</p>
      )}

      {data && (
        <div className="space-y-4">
          {hasFilter && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              📊 Showing metrics for {submittedDate}
            </div>
          )}
          {(showStaleAlert || showHealthyAlert || showNoActivityAlert) && (
            <div className="space-y-2">
              {showHealthyAlert && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ✅ Pipeline is healthy. Last run: {lastRunText}
                </div>
              )}
              {showStaleAlert && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  ⚠️ Pipeline hasn&apos;t run in over 24 hours.
                  {hasValidLastRun ? ` Last run: ${lastRun?.toLocaleString()}` : " Last run: unavailable."}
                </div>
              )}
              {showNoActivityAlert && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  ℹ️ No pipeline activity detected in selected view. Try another date or check crawler schedule.
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className={card}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Last crawl (proxy)</p>
              <p className="mt-1 break-all text-base text-slate-900">{lastRunText}</p>
              {hasValidLastRun && (
                <p className="mt-1 text-xs text-slate-500" title={lastRun?.toISOString()}>
                  Local time: {lastRun?.toLocaleString()}
                </p>
              )}
            </div>
            <div className={card}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Tweets fetched</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{data.tweets_fetched_count}</p>
            </div>
            <div className={card}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600/80">Signals created</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{data.signals_created_count}</p>
            </div>
          </div>
          <div className={card}>
            <h2 className="text-base font-semibold text-slate-900">Signal volume by category</h2>
            {data.per_category_signal_volume.length > 0 ? (
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
            ) : (
              <p className="mt-2 text-sm text-slate-500">No signals found in the selected date range.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPipelinePage;

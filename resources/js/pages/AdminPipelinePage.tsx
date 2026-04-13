import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPipelineStatus } from "@/services/adminService";

const AdminPipelinePage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "pipeline", "status"],
    queryFn: fetchPipelineStatus,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[#0f1419]">Pipeline monitor</h1>
        <p className="mt-1 text-[15px] text-[#536471]">
          Metrics theo ngày (UTC) — last crawl proxy qua{" "}
          <code className="rounded bg-[#eff3f4] px-1">max(last_crawled_at)</code>.
        </p>
      </div>

      {isLoading && <p className="text-[#536471]">Đang tải…</p>}
      {error && (
        <p className="text-red-600">{error instanceof Error ? error.message : "Lỗi tải dữ liệu"}</p>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#eff3f4] bg-white p-4 shadow-sm">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#536471]">
              Last crawl (proxy)
            </p>
            <p className="mt-1 break-all text-[16px] text-[#0f1419]">
              {data.last_run_timestamp ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-[#eff3f4] bg-white p-4 shadow-sm">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#536471]">
              Tweets (hôm nay)
            </p>
            <p className="mt-1 text-[24px] font-bold text-[#0f1419]">{data.tweets_fetched_count}</p>
          </div>
          <div className="rounded-xl border border-[#eff3f4] bg-white p-4 shadow-sm">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#536471]">
              Signals (hôm nay)
            </p>
            <p className="mt-1 text-[24px] font-bold text-[#0f1419]">{data.signals_created_count}</p>
          </div>
          <div className="rounded-xl border border-[#eff3f4] bg-white p-4 shadow-sm">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#536471]">
              Error rate (placeholder)
            </p>
            <p className="mt-1 text-[24px] font-bold text-[#0f1419]">{data.error_rate}</p>
          </div>
        </div>
      )}

      {data && data.per_category_signal_volume.length > 0 && (
        <div className="rounded-xl border border-[#eff3f4] bg-white p-4 shadow-sm">
          <h2 className="text-[16px] font-bold text-[#0f1419]">Volume theo category (signals hôm nay)</h2>
          <ul className="mt-3 space-y-2">
            {data.per_category_signal_volume.map((row) => (
              <li
                key={row.category_id}
                className="flex justify-between border-b border-[#f7f9f9] py-2 text-[15px] last:border-0"
              >
                <span className="text-[#0f1419]">{row.category_name}</span>
                <span className="font-medium text-[#536471]">{row.signal_count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminPipelinePage;

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listTweets } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";

type SourceOption = { id: number; display_name: string | null };
type TweetRow = {
  id: number;
  tweet_id: string;
  source_id: number;
  source_display_name: string | null;
  posted_at: string | null;
  signal_score: string;
  created_at: string | null;
};

const AdminTweetsPage: React.FC = () => {
  const [sourceId, setSourceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<TweetRow[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (sourceId) p.set("source_id", sourceId);
    if (startDate) p.set("start_date", startDate);
    if (endDate) p.set("end_date", endDate);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [sourceId, startDate, endDate, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listTweets(params) as {
        data: TweetRow[];
        meta: { total: number };
        filters?: { sources?: SourceOption[] };
      };
      setRows(response.data);
      setTotal(response.meta.total);
      setSources(response.filters?.sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const resetFilter = async () => {
    setSourceId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    const response = await listTweets(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: TweetRow[];
      meta: { total: number };
      filters?: { sources?: SourceOption[] };
    };
    setRows(response.data);
    setTotal(response.meta.total);
    setSources(response.filters?.sources ?? []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tweets</h1>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <select className="h-10 rounded-md border px-3" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>{source.display_name ?? `#${source.id}`}</option>
          ))}
        </select>
        <AdminSearchDateField value={startDate} onChange={setStartDate} placeholder="Start Time" />
        <AdminSearchDateField value={endDate} onChange={setEndDate} placeholder="End Time" />
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={() => void resetFilter()}>Reset</Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <p className="px-4 pt-3 text-sm text-slate-600">{formatAdminTableRange(page, perPage, total)}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Posted At</th>
                <th className="px-4 py-3 text-left">Signal Score</th>
                <th className="px-4 py-3 text-left">Created At</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                  <td className="px-4 py-3">{row.source_display_name ?? row.source_id}</td>
                  <td className="px-4 py-3">{row.posted_at}</td>
                  <td className="px-4 py-3">{row.signal_score}</td>
                  <td className="px-4 py-3">{row.created_at}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/tweets/${row.id}`}>Detail</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-5 text-center text-slate-500" colSpan={6}>
                    No tweets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminTableFooter page={page} perPage={perPage} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default AdminTweetsPage;

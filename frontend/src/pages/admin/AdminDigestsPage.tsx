import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDigests } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";

type DigestRow = {
  id: number;
  title: string | null;
  total_signals: number;
  created_at: string | null;
};

const AdminDigestsPage: React.FC = () => {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<DigestRow[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (title) p.set("title", title);
    if (startDate) p.set("start_date", startDate);
    if (endDate) p.set("end_date", endDate);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [title, startDate, endDate, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listDigests(params) as {
        data: DigestRow[];
        meta: { total: number };
      };
      setRows(response.data);
      setTotal(response.meta.total);
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
    setTitle("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    const response = await listDigests(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: DigestRow[];
      meta: { total: number };
    };
    setRows(response.data);
    setTotal(response.meta.total);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Digests</h1>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
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
            <thead className="border-b border-slate-100/60 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/50">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Total Signals</th>
                <th className="px-4 py-3 text-left">Created At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="px-4 py-3">{row.total_signals}</td>
                  <td className="px-4 py-3">{row.created_at}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-5 text-center text-slate-500" colSpan={4}>
                    No digests found.
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

export default AdminDigestsPage;

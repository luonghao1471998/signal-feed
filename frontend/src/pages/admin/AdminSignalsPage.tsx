import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSignals } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";

type Option = { id: number; title?: string; name?: string };
type SignalRow = {
  id: number;
  digest_id: number;
  digest_title: string | null;
  title: string;
  categories: string[];
  source_count: number;
  rank_score: string;
  created_at: string | null;
};

const AdminSignalsPage: React.FC = () => {
  const [digestId, setDigestId] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [digests, setDigests] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (digestId) p.set("digest_id", digestId);
    if (title) p.set("title", title);
    if (categoryId) p.set("category_id", categoryId);
    if (startDate) p.set("start_date", startDate);
    if (endDate) p.set("end_date", endDate);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [digestId, title, categoryId, startDate, endDate, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSignals(params) as {
        data: SignalRow[];
        meta: { total: number };
        filters?: { digests?: Option[]; categories?: Option[] };
      };
      setRows(response.data);
      setTotal(response.meta.total);
      setDigests(response.filters?.digests ?? []);
      setCategories(response.filters?.categories ?? []);
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
    setDigestId("");
    setTitle("");
    setCategoryId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    const response = await listSignals(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: SignalRow[];
      meta: { total: number };
      filters?: { digests?: Option[]; categories?: Option[] };
    };
    setRows(response.data);
    setTotal(response.meta.total);
    setDigests(response.filters?.digests ?? []);
    setCategories(response.filters?.categories ?? []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Signals</h1>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-7"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <select className="h-10 rounded-md border px-3" value={digestId} onChange={(e) => setDigestId(e.target.value)}>
          <option value="">All digests</option>
          {digests.map((digest) => (
            <option key={digest.id} value={digest.id}>{digest.title}</option>
          ))}
        </select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <select className="h-10 rounded-md border px-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <AdminSearchDateField value={startDate} onChange={setStartDate} placeholder="Start Time" />
        <AdminSearchDateField value={endDate} onChange={setEndDate} placeholder="End Time" />
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={() => void resetFilter()}>Reset</Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <p className="px-4 pt-3 text-sm text-slate-600">{formatAdminTableRange(page, perPage, total)}</p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Digest</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Categories</th>
              <th className="px-4 py-3 text-left">Source Count</th>
              <th className="px-4 py-3 text-left">Rank Score</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                <td className="px-4 py-3">{row.digest_title}</td>
                <td className="px-4 py-3">{row.title}</td>
                <td className="px-4 py-3">{row.categories.join(", ")}</td>
                <td className="px-4 py-3">{row.source_count}</td>
                <td className="px-4 py-3">{row.rank_score}</td>
                <td className="px-4 py-3">{row.created_at}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/signals/${row.id}`}>Detail</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-center text-slate-500" colSpan={8}>
                  No signals found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <AdminTableFooter page={page} perPage={perPage} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default AdminSignalsPage;

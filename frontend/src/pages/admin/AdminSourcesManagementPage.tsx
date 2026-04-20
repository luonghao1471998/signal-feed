import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSource, listSources } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";

type CategoryOption = { id: number; name: string };
type SourceRow = {
  id: number;
  x_handle: string;
  display_name: string | null;
  account_url: string;
  categories: CategoryOption[];
  type: string;
  status: string;
  created_at: string | null;
};

const AdminSourcesManagementPage: React.FC = () => {
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (displayName) p.set("display_name", displayName);
    if (status) p.set("status", status);
    if (type) p.set("type", type);
    if (startDate) p.set("start_date", startDate);
    if (endDate) p.set("end_date", endDate);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [displayName, status, type, startDate, endDate, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSources(params) as {
        data: SourceRow[];
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
    setDisplayName("");
    setStatus("");
    setType("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    const response = await listSources(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: SourceRow[];
      meta: { total: number };
    };
    setRows(response.data);
    setTotal(response.meta.total);
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete source?")) return;
    await deleteSource(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sources</h1>
        <Button asChild><Link to="/admin/sources/create">Add Source</Link></Button>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-7"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
        <select className="h-10 rounded-md border px-3" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="active">active</option>
          <option value="pending_review">pending_review</option>
          <option value="spam">spam</option>
          <option value="deleted">deleted</option>
        </select>
        <select className="h-10 rounded-md border px-3" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All type</option>
          <option value="default">default</option>
          <option value="user">user</option>
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
                <th className="px-4 py-3 text-left">Handle</th>
                <th className="px-4 py-3 text-left">Display Name</th>
                <th className="px-4 py-3 text-left">Account Url</th>
                <th className="px-4 py-3 text-left">Categories</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created At</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                  <td className="px-4 py-3">{row.x_handle}</td>
                  <td className="px-4 py-3">{row.display_name}</td>
                  <td className="px-4 py-3">
                    <a className="text-blue-600 hover:underline" href={row.account_url} target="_blank" rel="noreferrer">
                      {row.account_url}
                    </a>
                  </td>
                  <td className="px-4 py-3">{row.categories.map((x) => x.name).join(", ")}</td>
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.created_at}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/sources/update/${row.id}`}>Edit</Link>
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(row.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-5 text-center text-slate-500" colSpan={9}>
                    No sources found.
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

export default AdminSourcesManagementPage;

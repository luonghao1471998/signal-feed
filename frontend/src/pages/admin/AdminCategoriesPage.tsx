import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCategory, listCategories } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import AdminSearchDateField from "@/components/admin/AdminSearchDateField";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | null;
};

const AdminCategoriesPage: React.FC = () => {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (name) p.set("name", name);
    if (startDate) p.set("start_date", startDate);
    if (endDate) p.set("end_date", endDate);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [name, startDate, endDate, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCategories(params) as { data: CategoryRow[]; meta: { total: number } };
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
    setName("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    const response = await listCategories(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: CategoryRow[];
      meta: { total: number };
    };
    setRows(response.data);
    setTotal(response.meta.total);
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete category?")) return;
    await deleteCategory(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categories</h1>
        <Button asChild><Link to="/admin/categories/create">Add Category</Link></Button>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
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
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.description}</td>
                <td className="px-4 py-3">{row.created_at}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/categories/update/${row.id}`}>Edit</Link>
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void onDelete(row.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-center text-slate-500" colSpan={5}>
                  No categories found.
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

export default AdminCategoriesPage;

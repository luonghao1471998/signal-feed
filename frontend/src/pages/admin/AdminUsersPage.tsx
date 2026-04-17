import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listUsers } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";

type CategoryOption = { id: number; name: string };
type UserRow = {
  id: number;
  x_username: string;
  plan: "free" | "pro" | "power";
  my_categories: string[];
  my_category_ids: number[];
  display_name: string | null;
  email: string | null;
  locale: string | null;
  created_at: string | null;
};

const AdminUsersPage: React.FC = () => {
  const [displayName, setDisplayName] = useState("");
  const [plan, setPlan] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (displayName) p.set("display_name", displayName);
    if (plan) p.set("plan", plan);
    if (categoryId) p.set("category_id", categoryId);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [displayName, plan, categoryId, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listUsers(params) as {
        data: UserRow[];
        meta: { total: number };
        filters?: { categories?: CategoryOption[] };
      };
      setRows(response.data);
      setCategories(response.filters?.categories ?? []);
      setTotal(response.meta.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  const resetFilter = async () => {
    setDisplayName("");
    setPlan("");
    setCategoryId("");
    setPage(1);
    const response = await listUsers(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: UserRow[];
      meta: { total: number };
      filters?: { categories?: CategoryOption[] };
    };
    setRows(response.data);
    setTotal(response.meta.total);
    setCategories(response.filters?.categories ?? []);
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
        <select className="h-10 rounded-md border px-3" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">All plans</option>
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="power">power</option>
        </select>
        <select className="h-10 rounded-md border px-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void resetFilter()}
        >
          Reset
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <p className="px-4 pt-3 text-sm text-slate-600">{formatAdminTableRange(page, perPage, total)}</p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Categories</th>
              <th className="px-4 py-3 text-left">Display Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                <td className="px-4 py-3">{row.x_username}</td>
                <td className="px-4 py-3">{row.plan}</td>
                <td className="px-4 py-3">{row.my_categories.join(", ")}</td>
                <td className="px-4 py-3">{row.display_name}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">{row.created_at}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/admin/users/update/${row.id}`}>Edit</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-center text-slate-500" colSpan={8}>
                  No users found.
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

export default AdminUsersPage;

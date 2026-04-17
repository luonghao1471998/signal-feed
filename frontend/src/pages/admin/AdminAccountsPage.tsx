import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAdmin, listAdmins } from "@/services/adminPanelService";
import AdminTableFooter from "@/components/admin/AdminTableFooter";
import { formatAdminTableRange } from "@/components/admin/adminTableRange";
import type { AdminPanelRole } from "@/pages/admin/adminRoles";

type AdminRow = {
  id: number;
  name: string;
  email: string;
  role: AdminPanelRole;
  is_active: boolean;
  created_at: string | null;
};

const ROLE_LABEL: Record<AdminPanelRole, string> = {
  super_admin: "Super admin",
  moderator: "Moderator",
};

const AdminAccountsPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"" | AdminPanelRole>("");
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (email) p.set("email", email);
    if (role) p.set("role", role);
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    return p;
  }, [email, role, page]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdmins(params) as { data: AdminRow[]; meta: { total: number } };
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
    setEmail("");
    setRole("");
    setPage(1);
    const response = await listAdmins(new URLSearchParams({ page: "1", per_page: String(perPage) })) as {
      data: AdminRow[];
      meta: { total: number };
    };
    setRows(response.data);
    setTotal(response.meta.total);
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete admin account?")) return;
    await deleteAdmin(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Admins</h1>
        <Button type="button" asChild>
          <Link to="/admin/admins/create">Add Account</Link>
        </Button>
      </div>

      <form
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <select className="h-10 rounded-md border px-3" value={role} onChange={(e) => setRole(e.target.value as "" | AdminPanelRole)}>
          <option value="">All roles</option>
          <option value="super_admin">Super admin</option>
          <option value="moderator">Moderator</option>
        </select>
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
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Active</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{(page - 1) * perPage + idx + 1}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">{ROLE_LABEL[row.role] ?? row.role}</td>
                <td className="px-4 py-3">{row.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{row.created_at}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/admins/update/${row.id}`}>Edit</Link>
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void onDelete(row.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-center text-slate-500" colSpan={7}>
                  No admin account found.
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

export default AdminAccountsPage;

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAdmin, getAdmin, updateAdmin } from "@/services/adminPanelService";
import type { AdminPanelRole } from "@/pages/admin/adminRoles";

const ROLE_OPTIONS: Array<{ value: AdminPanelRole; label: string }> = [
  { value: "super_admin", label: "Super admin" },
  { value: "moderator", label: "Moderator" },
];

const AdminAdminFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminPanelRole>("moderator");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!isEdit || !id) return;
      const response = await getAdmin(Number(id)) as {
        data: {
          name: string;
          email: string;
          role: AdminPanelRole;
          is_active: boolean;
        };
      };
      setName(response.data.name);
      setEmail(response.data.email);
      setRole(response.data.role === "super_admin" ? "super_admin" : "moderator");
      setIsActive(response.data.is_active);
    };
    void load();
  }, [id, isEdit]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateAdmin(Number(id), {
          name,
          email,
          role,
          is_active: isActive,
          ...(password ? { password } : {}),
        });
      } else {
        await createAdmin({ name, email, password, role });
      }
      navigate("/admin/admins", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{isEdit ? "Edit Admin" : "Add Admin"}</h1>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form className="space-y-4 rounded-xl border border-zinc-200 bg-white shadow-sm p-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Role</label>
            <select
              className="h-10 w-full rounded-md border px-3"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminPanelRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required={!isEdit}
              minLength={isEdit ? undefined : 8}
              placeholder={isEdit ? "Leave blank to keep" : "Min. 8 characters"}
            />
          </div>
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Submit"}</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/admins">Back</Link>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminAdminFormPage;

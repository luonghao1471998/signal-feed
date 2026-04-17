import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, getCategory, updateCategory } from "@/services/adminPanelService";
import { slugify } from "@/lib/slugify";

const AdminCategoryFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const previewSlug = useMemo(() => slugify(name), [name]);

  useEffect(() => {
    if (!isEdit || !id) return;
    const load = async () => {
      const response = await getCategory(Number(id)) as {
        data: { name: string; description: string | null };
      };
      setName(response.data.name);
      setDescription(response.data.description ?? "");
    };
    void load();
  }, [id, isEdit]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateCategory(Number(id), {
          name,
          description: description || null,
        });
      } else {
        await createCategory({
          name,
          description: description || null,
        });
      }
      navigate("/admin/categories", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{isEdit ? "Edit Category" : "Add Category"}</h1>
      </div>
      <form className="space-y-4 rounded-xl border border-zinc-200 bg-white shadow-sm p-5" onSubmit={submit}>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Slug</label>
          <Input value={previewSlug} readOnly className="bg-slate-50" tabIndex={-1} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Submit"}</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/categories">Back</Link>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminCategoryFormPage;

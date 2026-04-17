import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSource, getSource, listCategories, updateSource } from "@/services/adminPanelService";

type Category = { id: number; name: string };

const AdminSourceFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [xHandle, setXHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountUrl, setAccountUrl] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const categoriesRes = await listCategories(new URLSearchParams({ per_page: "100" })) as { data: Category[] };
      setCategories(categoriesRes.data);
      if (isEdit && id) {
        const sourceRes = await getSource(Number(id)) as {
          data: {
            x_handle: string;
            display_name: string | null;
            account_url: string;
            category_ids: number[];
          };
        };
        setXHandle(sourceRes.data.x_handle);
        setDisplayName(sourceRes.data.display_name ?? "");
        setAccountUrl(sourceRes.data.account_url);
        setSelectedCategoryIds(sourceRes.data.category_ids ?? []);
      }
    };
    void load();
  }, [id, isEdit]);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((x) => x !== categoryId) : [...prev, categoryId],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        x_handle: xHandle,
        display_name: displayName || null,
        account_url: accountUrl,
        category_ids: selectedCategoryIds,
      };
      if (isEdit && id) {
        await updateSource(Number(id), payload);
      } else {
        await createSource(payload);
      }
      navigate("/admin/sources", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{isEdit ? "Edit Source" : "Add Source"}</h1>
      </div>
      <form className="space-y-4 rounded-xl border border-zinc-200 bg-white shadow-sm p-5" onSubmit={submit}>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Handle</label>
          <Input value={xHandle} onChange={(e) => setXHandle(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Display Name</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Account Url</label>
          <Input value={accountUrl} onChange={(e) => setAccountUrl(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Categories</label>
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
            {categories.map((category) => (
              <label key={category.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                />
                {category.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Submit"}</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/sources">Back</Link>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminSourceFormPage;

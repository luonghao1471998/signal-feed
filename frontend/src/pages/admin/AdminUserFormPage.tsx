import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUser, listCategories, updateUser } from "@/services/adminPanelService";

type Category = { id: number; name: string };

type UiLocale = "en" | "vi";

function normalizeLocale(raw: string | null | undefined): UiLocale {
  if (raw === "vi" || raw === "en") {
    return raw;
  }
  return "en";
}

const AdminUserFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState("free");
  const [locale, setLocale] = useState<UiLocale>("en");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const categoriesRes = await listCategories(new URLSearchParams({ per_page: "100" })) as { data: Category[] };
      setCategories(categoriesRes.data);
      if (!id) return;
      const userRes = await getUser(Number(id)) as {
        data: {
          plan: "free" | "pro" | "power";
          locale: string;
          display_name: string | null;
          email: string | null;
          my_category_ids: number[];
        };
      };
      setPlan(userRes.data.plan);
      setLocale(normalizeLocale(userRes.data.locale));
      setDisplayName(userRes.data.display_name ?? "");
      setEmail(userRes.data.email ?? "");
      setSelectedCategoryIds(userRes.data.my_category_ids ?? []);
    };
    void load();
  }, [id]);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((x) => x !== categoryId) : [...prev, categoryId],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setLoading(true);
    try {
      await updateUser(Number(id), {
        plan,
        locale,
        display_name: displayName || null,
        email: email || null,
        my_category_ids: selectedCategoryIds,
      });
      navigate("/admin/users", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit User</h1>
      </div>
      <form className="space-y-4 rounded-xl border border-zinc-200 bg-white shadow-sm p-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Plan</label>
            <select className="h-10 rounded-md border px-3" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="power">power</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Locale</label>
            <select className="h-10 rounded-md border px-3" value={locale} onChange={(e) => setLocale(e.target.value as UiLocale)}>
              <option value="en">en</option>
              <option value="vi">vi</option>
            </select>
          </div>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Categories</label>
          <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
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
            <Link to="/admin/users">Back</Link>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminUserFormPage;

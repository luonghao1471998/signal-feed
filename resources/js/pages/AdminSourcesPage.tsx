import React, { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminSources,
  moderateAdminSource,
  type AdminSourceRow,
} from "@/services/adminService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";

interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

async function fetchCategoryOptions(): Promise<CategoryOption[]> {
  const res = await fetch("/api/categories", {
    credentials: "same-origin",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  if (!res.ok) {
    throw new Error("Không tải được danh mục.");
  }
  const json = (await res.json()) as { data: CategoryOption[] };
  return json.data;
}

const AdminSourcesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [categoryDialog, setCategoryDialog] = useState<AdminSourceRow | null>(null);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);

  const { data: categories } = useQuery({
    queryKey: ["categories", "public"],
    queryFn: fetchCategoryOptions,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "sources", "user"],
    queryFn: () => fetchAdminSources({ type: "user", perPage: 100 }),
  });

  const rows = data?.data ?? [];

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "sources"] });
  }, [queryClient]);

  useEffect(() => {
    if (categoryDialog) {
      setSelectedCats(categoryDialog.categories.map((c) => c.id));
    }
  }, [categoryDialog]);

  const onModerate = async (
    row: AdminSourceRow,
    action: "flag_spam" | "soft_delete" | "restore",
  ) => {
    try {
      await moderateAdminSource(row.id, { action });
      toast({ title: "Đã cập nhật nguồn." });
      refresh();
    } catch (e) {
      toast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thực hiện được.",
        variant: "destructive",
      });
    }
  };

  const onSaveCategories = async () => {
    if (!categoryDialog) {
      return;
    }
    if (selectedCats.length < 1) {
      toast({
        title: "Chọn ít nhất một category.",
        variant: "destructive",
      });
      return;
    }
    try {
      await moderateAdminSource(categoryDialog.id, {
        action: "adjust_categories",
        category_ids: selectedCats,
      });
      toast({ title: "Đã cập nhật category." });
      setCategoryDialog(null);
      refresh();
    } catch (e) {
      toast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thực hiện được.",
        variant: "destructive",
      });
    }
  };

  const toggleCat = (id: number) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-[#0f1419]">Moderation nguồn (user-added)</h1>
        <p className="mt-1 text-[15px] text-[#536471]">
          Hậu kiểm theo SPEC Flow 6 — Option A (đã active trước khi duyệt).
        </p>
      </div>

      {isLoading && <p className="text-[#536471]">Đang tải…</p>}
      {error && (
        <p className="text-red-600">{error instanceof Error ? error.message : "Lỗi tải dữ liệu"}</p>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border border-[#eff3f4] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Handle</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Signals</TableHead>
                <TableHead className="text-right">Noise %</TableHead>
                <TableHead className="w-[280px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-[#536471]">
                    Không có nguồn user.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-[#0f1419]">@{row.handle}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-right">{row.signal_count}</TableCell>
                    <TableCell className="text-right">
                      {row.noise_ratio === null ? "—" : `${row.noise_ratio}%`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {row.status === "active" && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[13px]"
                              onClick={() => void onModerate(row, "flag_spam")}
                            >
                              Spam
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[13px]"
                              onClick={() => void onModerate(row, "soft_delete")}
                            >
                              Ẩn
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 text-[13px]"
                              onClick={() => setCategoryDialog(row)}
                            >
                              Category
                            </Button>
                          </>
                        )}
                        {(row.status === "spam" || row.status === "deleted") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[13px]"
                            onClick={() => void onModerate(row, "restore")}
                          >
                            Khôi phục
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={categoryDialog !== null} onOpenChange={(o) => !o && setCategoryDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh category — @{categoryDialog?.handle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {categories?.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#eff3f4] px-3 py-2 hover:bg-[#f7f9f9]"
              >
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c.id)}
                  onChange={() => toggleCat(c.id)}
                  className="h-4 w-4 accent-[#1d9bf0]"
                />
                <span className="text-[15px] text-[#0f1419]">{c.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryDialog(null)}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void onSaveCategories()}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSourcesPage;

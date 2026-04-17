import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCategories } from "@/services/categoryService";
import { moderateSource, type AdminSource } from "@/services/adminSourceService";

interface AdjustCategoriesModalProps {
  open: boolean;
  onClose: () => void;
  source: AdminSource | null;
  onSuccess: () => void;
}

const AdjustCategoriesModal: React.FC<AdjustCategoriesModalProps> = ({ open, onClose, source, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const data = await getCategories();
        if (!cancelled) {
          setCategories(data);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load categories";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    setSelectedCategoryIds(source?.categories.map((category) => category.id) ?? []);
  }, [source]);

  const sourceHandle = source?.x_handle ? `@${source.x_handle}` : "";

  const categoryMap = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    );
  };

  const handleSave = async () => {
    if (!source) {
      return;
    }

    if (selectedCategoryIds.length < 1) {
      toast.error("Please select at least one category");
      return;
    }

    setSaving(true);
    try {
      await moderateSource(source.id, {
        action: "adjust_categories",
        category_ids: selectedCategoryIds,
      });
      toast.success("Categories updated successfully");
      onClose();
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update categories";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust Categories {sourceHandle ? `- ${sourceHandle}` : ""}</DialogTitle>
          <DialogDescription>Update categories for this source.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {loadingCategories ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading categories...
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  htmlFor={`adjust-category-${category.id}`}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <Checkbox
                    id={`adjust-category-${category.id}`}
                    checked={categoryMap.has(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                    disabled={saving}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    {category.name} <span className="text-muted-foreground">({category.slug})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loadingCategories}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdjustCategoriesModal;

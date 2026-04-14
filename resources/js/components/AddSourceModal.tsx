import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchCategories, type ApiCategory } from "@/services/signalService";
import { CreateSourceError, createSource } from "@/services/sourceService";
import { cn } from "@/lib/utils";

export interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultForm = {
  handle: "",
  display_name: "",
  category_ids: [] as number[],
};

const DISPLAY_NAME_MAX = 100;

export function AddSourceModal({ isOpen, onClose }: AddSourceModalProps) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const list = await fetchCategories();
      setCategories(list);
    } catch {
      toast.error("Could not load categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadCategories();
      setFieldErrors({});
      setGlobalError(null);
    }
  }, [isOpen, loadCategories]);

  const validateClient = (): boolean => {
    const next: Record<string, string> = {};
    const trimmedHandle = form.handle.trim();
    if (!trimmedHandle) {
      next.handle = "Handle is required";
    } else if (!trimmedHandle.startsWith("@")) {
      next.handle = "Handle must start with @";
    } else if (!/^@[A-Za-z0-9_]{1,15}$/.test(trimmedHandle)) {
      next.handle = "Use a valid X handle (@name, up to 15 characters)";
    }

    const dn = form.display_name.trim();
    if (dn.length > DISPLAY_NAME_MAX) {
      next.display_name = `Display name must be at most ${DISPLAY_NAME_MAX} characters`;
    }

    if (form.category_ids.length === 0) {
      next.category_ids = "Select at least 1 category";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const toggleCategory = (id: number) => {
    setForm((prev) => {
      const has = prev.category_ids.includes(id);
      return {
        ...prev,
        category_ids: has ? prev.category_ids.filter((x) => x !== id) : [...prev.category_ids, id],
      };
    });
    setFieldErrors((e) => {
      const rest = { ...e };
      delete rest.category_ids;
      return rest;
    });
  };

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setGlobalError(null);
  };

  const handleDismiss = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClient()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setGlobalError(null);

    try {
      await createSource({
        handle: form.handle.trim(),
        display_name: form.display_name.trim() || undefined,
        category_ids: form.category_ids,
      });

      toast.success("Source submitted for review");
      toast.info("Admin will review your request. You'll be notified when approved.", {
        duration: 5000,
      });

      resetForm();
      onClose();
    } catch (err) {
      if (err instanceof CreateSourceError) {
        if (err.status === 422 && err.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            if (msgs?.[0]) {
              const shortKey = key.startsWith("category_ids") ? "category_ids" : key.replace(/\.\d+$/, "");
              flat[shortKey] = msgs[0];
            }
          }
          if (Object.keys(flat).length) {
            setFieldErrors(flat);
          }
          setGlobalError(err.message);
          return;
        }
        if (err.status === 403) {
          toast.error("Upgrade required", {
            description: err.message,
          });
          return;
        }
      }
      const message = err instanceof Error ? err.message : "Failed to submit source. Please try again.";
      setGlobalError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add KOL Source</DialogTitle>
          <DialogDescription>
            Submit a KOL for admin review. After approval it will join the browse pool and can be followed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-source-handle">@handle *</Label>
            <Input
              id="add-source-handle"
              autoFocus
              autoComplete="off"
              placeholder="@username"
              value={form.handle}
              onChange={(e) => {
                setForm((f) => ({ ...f, handle: e.target.value }));
                setFieldErrors((fe) => {
                  const { handle: _h, ...rest } = fe;
                  return rest;
                });
              }}
              disabled={loading}
              className={cn(fieldErrors.handle && "border-destructive")}
            />
            {fieldErrors.handle ? <p className="text-sm text-destructive">{fieldErrors.handle}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-source-display">Display name (optional)</Label>
            <Input
              id="add-source-display"
              placeholder="Friendly name"
              maxLength={DISPLAY_NAME_MAX}
              value={form.display_name}
              onChange={(e) => {
                setForm((f) => ({ ...f, display_name: e.target.value }));
                setFieldErrors((fe) => {
                  const { display_name: _d, ...rest } = fe;
                  return rest;
                });
              }}
              disabled={loading}
              className={cn(fieldErrors.display_name && "border-destructive")}
            />
            <p className="text-xs text-muted-foreground">
              {form.display_name.trim().length}/{DISPLAY_NAME_MAX}
            </p>
            {fieldErrors.display_name ? (
              <p className="text-sm text-destructive">{fieldErrors.display_name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Categories *</Label>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">Loading categories…</p>
            ) : (
              <div className="grid max-h-48 grid-cols-2 gap-3 overflow-y-auto rounded-md border p-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`category-${cat.id}`}
                      checked={form.category_ids.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                      disabled={loading}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`category-${cat.id}`} className="cursor-pointer text-sm font-normal leading-snug">
                      <span className="block">{cat.name}</span>
                      <span className="text-muted-foreground">({cat.slug})</span>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            {fieldErrors.category_ids ? (
              <p className="text-sm text-destructive">{fieldErrors.category_ids}</p>
            ) : null}
          </div>

          {globalError ? <p className="text-sm text-destructive">{globalError}</p> : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleDismiss} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || categoriesLoading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

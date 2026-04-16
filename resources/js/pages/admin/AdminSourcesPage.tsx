import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdjustCategoriesModal from "@/components/admin/AdjustCategoriesModal";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchAdminSources,
  moderateSource,
  type AdminSource,
  type AdminSourceStatus,
  type ModerateAction,
} from "@/services/adminSourceService";

type DialogAction = Extract<ModerateAction, "flag_spam" | "soft_delete" | "restore">;

const statusOptions: Array<{ value: AdminSourceStatus; label: string }> = [
  { value: "pending_review", label: "Pending Review" },
  { value: "active", label: "Active" },
  { value: "spam", label: "Spam" },
  { value: "deleted", label: "Deleted" },
];

interface ConfirmDialogState {
  source: AdminSource;
  action: DialogAction;
}

function getConfirmDialogContent(action: DialogAction): {
  title: string;
  description: string;
  confirmText: string;
  destructive: boolean;
} {
  if (action === "flag_spam") {
    return {
      title: "Flag source as spam?",
      description: "Are you sure you want to flag this source as spam?",
      confirmText: "Flag Spam",
      destructive: true,
    };
  }

  if (action === "soft_delete") {
    return {
      title: "Soft delete source?",
      description: "This will soft delete the source. Continue?",
      confirmText: "Soft Delete",
      destructive: true,
    };
  }

  return {
    title: "Restore source?",
    description: "Restore this source to active status?",
    confirmText: "Restore",
    destructive: false,
  };
}

function getActionButtonsByStatus(status: AdminSourceStatus): ModerateAction[] {
  if (status === "pending_review") {
    return ["approve", "flag_spam", "adjust_categories", "soft_delete"];
  }
  if (status === "active") {
    return ["adjust_categories", "flag_spam", "soft_delete"];
  }
  if (status === "spam" || status === "deleted") {
    return ["restore"];
  }

  return [];
}

const AdminSourcesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminSourceStatus>("pending_review");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [adjustingSource, setAdjustingSource] = useState<AdminSource | null>(null);
  const [activeAction, setActiveAction] = useState<{ sourceId: number; action: ModerateAction } | null>(null);

  const queryKey = useMemo(() => ["adminSources", status, page], [status, page]);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchAdminSources({ type: "user", status, page }),
  });

  const sources = data?.data ?? [];
  const filteredSources = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword === "") {
      return sources;
    }

    return sources.filter((source) => (source.display_name ?? "").toLowerCase().includes(keyword));
  }, [searchKeyword, sources]);
  const meta = data?.meta;
  const applySearch = () => {
    setSearchKeyword(searchInput.trim());
    setPage(1);
  };

  const hasPrevPage = (meta?.current_page ?? 1) > 1;
  const hasNextPage = (meta?.current_page ?? 1) < (meta?.last_page ?? 1);

  const invalidateCurrentQuery = async () => {
    await queryClient.invalidateQueries({ queryKey: ["adminSources"] });
  };

  const executeAction = async (source: AdminSource, action: ModerateAction) => {
    setActiveAction({ sourceId: source.id, action });
    try {
      await moderateSource(source.id, { action });
      if (action === "approve") {
        toast.success("Source approved successfully");
      } else if (action === "flag_spam") {
        toast.success("Source flagged as spam");
      } else if (action === "soft_delete") {
        toast.success("Source soft deleted");
      } else if (action === "restore") {
        toast.success("Source restored successfully");
      }
      await invalidateCurrentQuery();
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "Action failed";
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  };

  const renderActionButtons = (source: AdminSource) => {
    const actions = getActionButtonsByStatus(status);

    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const isProcessing = activeAction?.sourceId === source.id && activeAction.action === action;
          if (action === "approve") {
            return (
              <Button
                key={`${source.id}-approve`}
                type="button"
                size="sm"
                onClick={() => void executeAction(source, "approve")}
                disabled={activeAction !== null}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
              </Button>
            );
          }

          if (action === "adjust_categories") {
            return (
              <Button
                key={`${source.id}-adjust-categories`}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdjustingSource(source)}
                disabled={activeAction !== null}
              >
                Adjust Categories
              </Button>
            );
          }

          if (action === "restore") {
            return (
              <Button
                key={`${source.id}-restore`}
                type="button"
                size="sm"
                onClick={() => setConfirmDialog({ source, action: "restore" })}
                disabled={activeAction !== null}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore"}
              </Button>
            );
          }

          const label = action === "flag_spam" ? "Flag Spam" : "Soft Delete";
          return (
            <Button
              key={`${source.id}-${action}`}
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDialog({ source, action })}
              disabled={activeAction !== null}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
            </Button>
          );
        })}
      </div>
    );
  };

  const setStatusTab = (nextStatus: string) => {
    const normalized = nextStatus as AdminSourceStatus;
    setStatus(normalized);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f1419]">Source Moderation Queue</h1>
          <p className="text-sm text-muted-foreground">Review and moderate user-submitted sources.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={status} onValueChange={setStatusTab}>
        <TabsList>
          {statusOptions.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applySearch();
            }
          }}
          placeholder="Search by display name..."
          className="w-full max-w-sm"
        />
        <Button type="button" onClick={applySearch}>
          Search
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load sources."}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Handle</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead className="text-right">Signals</TableHead>
                <TableHead className="text-right">Noise</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {searchKeyword ? "No matching sources found." : "All caught up! No sources awaiting review."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <a
                        href={source.account_url ?? `https://x.com/${source.x_handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[#1d9bf0] hover:underline"
                      >
                        @{source.x_handle}
                      </a>
                    </TableCell>
                    <TableCell>{source.display_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {source.categories.length > 0
                          ? source.categories.map((category) => (
                              <span
                                key={`${source.id}-cat-${category.id}`}
                                className="rounded-full bg-[#eff3f4] px-2 py-0.5 text-xs text-[#536471]"
                              >
                                {category.name}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell>{source.added_by_user?.email ?? "—"}</TableCell>
                    <TableCell className="text-right">{source.signal_count}</TableCell>
                    <TableCell className="text-right">
                      {typeof source.noise_ratio === "number" ? `${source.noise_ratio}%` : "—"}
                    </TableCell>
                    <TableCell>
                      {source.created_at ? format(new Date(source.created_at), "yyyy-MM-dd HH:mm:ss") : "—"}
                    </TableCell>
                    <TableCell>{renderActionButtons(source)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!isLoading && !isError && meta ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current - 1)}
            disabled={!hasPrevPage || isFetching}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNextPage || isFetching}
          >
            Next
          </Button>
        </div>
      ) : null}

      <AdjustCategoriesModal
        open={adjustingSource !== null}
        source={adjustingSource}
        onClose={() => setAdjustingSource(null)}
        onSuccess={() => {
          void invalidateCurrentQuery();
        }}
      />

      <ConfirmActionDialog
        open={confirmDialog !== null}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }
          const { source, action } = confirmDialog;
          setConfirmDialog(null);
          void executeAction(source, action);
        }}
        title={confirmDialog ? getConfirmDialogContent(confirmDialog.action).title : ""}
        description={confirmDialog ? getConfirmDialogContent(confirmDialog.action).description : ""}
        confirmText={confirmDialog ? getConfirmDialogContent(confirmDialog.action).confirmText : "Confirm"}
        destructive={confirmDialog ? getConfirmDialogContent(confirmDialog.action).destructive : false}
      />
    </div>
  );
};

export default AdminSourcesPage;

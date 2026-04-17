import React from "react";
import { Button } from "@/components/ui/button";

interface AdminTableFooterProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
}

const AdminTableFooter: React.FC<AdminTableFooterProps> = ({ page, perPage, total, onPageChange }) => {
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100/70 bg-white/95 px-4 py-3 text-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="border-slate-200/60 hover:bg-slate-50/50" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <span className="text-slate-600">
          Page {page}/{lastPage}
        </span>
        <Button size="sm" variant="outline" className="border-slate-200/60 hover:bg-slate-50/50" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default AdminTableFooter;

import React from "react";

export interface DigestFilterBarProps {
  onDateChange: (date: string) => void;
  onCategoryChange: (categoryIds: number[]) => void;
  onMySourcesToggle: (enabled: boolean) => void;
  currentDate: string;
  selectedCategories: number[];
  mySourcesOnly: boolean;
  userPlan: "free" | "pro" | "power";
  /** Options cho multi-select (id + label), ví dụ từ GET /api/categories + user.my_categories */
  categoryOptions?: Array<{ id: number; label: string }>;
}

const DigestFilterBar: React.FC<DigestFilterBarProps> = ({
  onDateChange,
  onCategoryChange,
  onMySourcesToggle,
  currentDate,
  selectedCategories,
  mySourcesOnly,
  userPlan,
  categoryOptions = [],
}) => {
  return (
    <div className="filters-bar flex flex-wrap gap-4 items-center border-b border-slate-100 py-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Date
        <input
          type="date"
          value={currentDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900"
        />
      </label>

      {categoryOptions.length > 0 && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Categories
          <select
            multiple
            value={selectedCategories.map(String)}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((opt) => parseInt(opt.value, 10));
              onCategoryChange(selected);
            }}
            className="min-h-[120px] rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {userPlan !== "free" && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={mySourcesOnly}
            onChange={(e) => onMySourcesToggle(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>My Sources Only</span>
        </label>
      )}
    </div>
  );
};

export default DigestFilterBar;

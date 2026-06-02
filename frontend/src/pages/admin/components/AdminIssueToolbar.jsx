import { Search } from "lucide-react";

import { ADMIN_SORT_OPTIONS } from "../utils/issueListPipeline";

export default function AdminIssueToolbar({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-zinc-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">Search issues</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search ID, title, address, category, department, citizen"
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-700/40"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="shrink-0">Sort</span>
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-700/40"
        >
          {ADMIN_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

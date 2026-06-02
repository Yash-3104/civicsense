export const ADMIN_SORT_OPTIONS = [
  { value: "NEWEST_FIRST", label: "Newest First" },
  { value: "OPERATIONAL_PRIORITY", label: "Operational Priority" },
  { value: "OLDEST_FIRST", label: "Oldest First" },
  { value: "PRIORITY_SCORE", label: "Priority Score" },
  { value: "SEVERITY", label: "Severity" },
  { value: "STATUS", label: "Status" },
  { value: "SLA_DEADLINE", label: "SLA Deadline" },
  { value: "ESCALATION_LEVEL", label: "Escalation Level" },
];

export const ADMIN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const SEVERITY_RANK = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const ESCALATION_RANK = {
  LEVEL_3: 3,
  LEVEL_2: 2,
  LEVEL_1: 1,
};

const OPEN_STATUSES = new Set([
  "REPORTED",
  "VERIFIED",
  "ASSIGNED",
  "PENDING_CLOSURE",
]);

const EXCLUDED_DEPARTMENT_STATUSES = new Set(["RESOLVED", "REJECTED"]);

export function getSlaState(issue) {
  if (!issue || issue.status === "RESOLVED" || issue.status === "REJECTED") {
    return "CLOSED";
  }

  if (!issue.slaDeadline) {
    return "NOT_STARTED";
  }

  const deadline = new Date(issue.slaDeadline).getTime();

  if (!Number.isFinite(deadline)) {
    return "UNKNOWN";
  }

  const diffMs = deadline - Date.now();

  if (issue.slaBreached || diffMs < 0) {
    return "BREACHED";
  }

  if (diffMs <= 24 * 60 * 60 * 1000) {
    return "DUE_SOON";
  }

  return "ON_TRACK";
}

export function applyModerationFilter(issues, activeFilter) {
  switch (activeFilter) {
    case "AI_FLAGGED":
      return issues.filter((issue) => {
        return (
          (issue.fakeReportLikelihood || 0) >= 0.6 ||
          (issue.duplicateLikelihood || 0) >= 0.55 ||
          (issue.aiConfidenceScore || 1) <= 0.4
        );
      });

    case "DUPLICATES":
      return issues.filter(
        (issue) => (issue.duplicateLikelihood || 0) >= 0.55
      );

    case "LOW_CONFIDENCE":
      return issues.filter((issue) => (issue.aiConfidenceScore || 1) <= 0.4);

    case "HIGH_SEVERITY":
      return issues.filter((issue) => issue.severity === "HIGH");

    case "UNRESOLVED":
      return issues.filter((issue) => issue.status !== "RESOLVED");

    case "PENDING_CLOSURE":
      return issues.filter((issue) => issue.status === "PENDING_CLOSURE");

    case "DUE_SOON":
      return issues.filter((issue) => getSlaState(issue) === "DUE_SOON");

    case "SLA_BREACHED":
      return issues.filter((issue) => getSlaState(issue) === "BREACHED");

    default:
      return issues;
  }
}

function searchableValues(issue) {
  return [
    issue.id,
    issue.title,
    issue.address,
    issue.category,
    issue.assignedDepartment,
    issue.citizenName,
    issue.citizen?.name,
    issue.reportedBy?.name,
    issue.createdBy?.name,
    issue.user?.name,
  ];
}

export function searchIssues(issues, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return issues;
  }

  return issues.filter((issue) => {
    return searchableValues(issue).some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch)
    );
  });
}

function dateValue(value, fallback) {
  if (!value) return fallback;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function priorityScore(issue) {
  const value =
    issue.priorityScore ??
    issue.priority_score ??
    issue.operationalPriorityScore ??
    issue.aiPriorityScore;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function operationalPriority(issue) {
  const slaState = getSlaState(issue);
  const slaPriority =
    slaState === "BREACHED" ? 2 : slaState === "DUE_SOON" ? 1 : 0;

  const risk =
    (Number(issue.fakeReportLikelihood) || 0) +
    (Number(issue.duplicateLikelihood) || 0);

  return {
    slaPriority,
    risk,
    createdAt: dateValue(issue.createdAt, 0),
  };
}

export function sortIssues(issues, sortBy) {
  return [...issues].sort((a, b) => {
    if (sortBy === "OPERATIONAL_PRIORITY") {
      const aPriority = operationalPriority(a);
      const bPriority = operationalPriority(b);

      if (bPriority.slaPriority !== aPriority.slaPriority) {
        return bPriority.slaPriority - aPriority.slaPriority;
      }

      if (bPriority.risk !== aPriority.risk) {
        return bPriority.risk - aPriority.risk;
      }

      return bPriority.createdAt - aPriority.createdAt;
    }

    if (sortBy === "OLDEST_FIRST") {
      return dateValue(a.createdAt, Number.MAX_SAFE_INTEGER) - dateValue(b.createdAt, Number.MAX_SAFE_INTEGER);
    }

    if (sortBy === "PRIORITY_SCORE") {
      return (priorityScore(b) ?? -1) - (priorityScore(a) ?? -1);
    }

    if (sortBy === "SEVERITY") {
      return (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    }

    if (sortBy === "STATUS") {
      return String(a.status || "").localeCompare(String(b.status || ""));
    }

    if (sortBy === "SLA_DEADLINE") {
      return dateValue(a.slaDeadline, Number.MAX_SAFE_INTEGER) - dateValue(b.slaDeadline, Number.MAX_SAFE_INTEGER);
    }

    if (sortBy === "ESCALATION_LEVEL") {
      return (ESCALATION_RANK[b.escalationLevel] || 0) - (ESCALATION_RANK[a.escalationLevel] || 0);
    }

    return dateValue(b.createdAt, 0) - dateValue(a.createdAt, 0);
  });
}

export function paginateIssues(issues, page, pageSize) {
  const totalItems = issues.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    items: issues.slice(startIndex, endIndex),
    page: safePage,
    totalPages,
    totalItems,
    startItem: totalItems === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
  };
}

export function buildIssueListPipeline({
  issues,
  activeFilter,
  searchTerm,
  sortBy,
  page,
  pageSize,
}) {
  const moderatedIssues = applyModerationFilter(issues, activeFilter);
  const searchedIssues = searchIssues(moderatedIssues, searchTerm);
  const sortedIssues = sortIssues(searchedIssues, sortBy);
  const paginatedIssues = paginateIssues(sortedIssues, page, pageSize);

  return {
    moderatedIssues,
    searchedIssues,
    sortedIssues,
    ...paginatedIssues,
  };
}

const ALL_DEPARTMENTS = [
  "DRAINAGE_DEPARTMENT",
  "ELECTRICAL_DEPARTMENT",
  "PUBLIC_WORKS",
  "ROAD_MAINTENANCE",
  "SANITATION_DEPARTMENT",
  "SEWAGE_DEPARTMENT",
  "STREETLIGHT_MAINTENANCE",
  "URBAN_INFRASTRUCTURE",
  "WASTE_MANAGEMENT",
  "WATER_SUPPLY",
];

export function buildDepartmentPerformance(issues) {
  const departments = new Map();

  // Pass 1:
  // Discover ALL departments from ALL issues
  issues.forEach((issue) => {
    const department = issue.assignedDepartment;

    if (!department) {
      return;
    }

    if (!departments.has(department)) {
      departments.set(department, {
        department,
        open: 0,
        inProgress: 0,
        escalated: 0,
        totalActiveWorkload: 0,
      });
    }
  });

  // Pass 2:
  // Count only active issues
  issues.forEach((issue) => {
    if (EXCLUDED_DEPARTMENT_STATUSES.has(issue.status)) {
      return;
    }

    const department = issue.assignedDepartment;

    if (!department || !departments.has(department)) {
      return;
    }

    const existing = departments.get(department);

    if (OPEN_STATUSES.has(issue.status)) {
      existing.open += 1;
    }

    if (issue.status === "IN_PROGRESS") {
      existing.inProgress += 1;
    }

    if (issue.escalationLevel || issue.slaBreached) {
      existing.escalated += 1;
    }

    existing.totalActiveWorkload =
      existing.open + existing.inProgress;
  });

  return [...departments.values()].sort((a, b) => {
    if (b.totalActiveWorkload !== a.totalActiveWorkload) {
      return b.totalActiveWorkload - a.totalActiveWorkload;
    }

    if (b.escalated !== a.escalated) {
      return b.escalated - a.escalated;
    }

    return a.department.localeCompare(b.department);
  });
}
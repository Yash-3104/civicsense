package com.civicsense.backend.service;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueCategory;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.SeverityLevel;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.entity.WorkerDepartment;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.repository.WorkerDepartmentRepository;
import com.civicsense.backend.security.CustomUserDetails;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CsvExportService {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;

    @Transactional(readOnly = true)
    public String exportAdminIssues(
            IssueCategory category,
            SeverityLevel severity,
            IssueStatus status,
            Boolean slaBreached,
            Boolean escalated
    ) {
        List<Issue> issues = issueRepository.findAll()
                .stream()
                .filter(issue -> category == null || issue.getCategory() == category)
                .filter(issue -> severity == null || issue.getSeverity() == severity)
                .filter(issue -> status == null || issue.getStatus() == status)
                .filter(issue -> slaBreached == null || isSlaBreached(issue) == slaBreached)
                .filter(issue -> escalated == null || isEscalated(issue) == escalated)
                .sorted(compareByUpdatedAtDesc())
                .toList();

        CsvBuilder csv = new CsvBuilder();

        csv.row(
                "Issue ID",
                "Title",
                "Category",
                "Status",
                "Severity",
                "Address",
                "Department",
                "Assigned Worker",
                "Assigned Worker Email",
                "Created At",
                "Updated At",
                "Assigned At",
                "SLA Deadline",
                "SLA Breached",
                "Escalated",
                "Escalation Level",
                "Escalation Reason",
                "Rejection Reason",
                "Rejected At",
                "Resolved At"
        );

        issues.forEach(issue -> csv.row(
                safe(issue.getId()),
                issue.getTitle(),
                safeEnum(issue.getCategory()),
                safeEnum(issue.getStatus()),
                safeEnum(issue.getSeverity()),
                issue.getAddress(),
                safeEnum(issue.getAssignedDepartment()),
                safeUserName(issue.getAssignedTo()),
                safeUserEmail(issue.getAssignedTo()),
                safe(issue.getCreatedAt()),
                safe(issue.getUpdatedAt()),
                safe(issue.getAssignedAt()),
                safe(issue.getSlaDeadline()),
                String.valueOf(isSlaBreached(issue)),
                String.valueOf(isEscalated(issue)),
                issue.getEscalationLevel(),
                safeEnum(issue.getEscalationReason()),
                safeEnum(issue.getRejectionReason()),
                safe(issue.getRejectedAt()),
                safe(issue.getResolvedAt())
        ));

        return csv.build();
    }

    @Transactional(readOnly = true)
    public String exportSupervisorTasks() {
        User currentUser = getCurrentUser();
        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser)
                .stream()
                .filter(this::isActiveOperationalIssue)
                .sorted(compareIssueRiskThenUpdated())
                .toList();

        CsvBuilder csv = new CsvBuilder();

        csv.row(
                "Issue ID",
                "Title",
                "Category",
                "Status",
                "Severity",
                "Address",
                "Department",
                "Assigned Worker",
                "Assigned At",
                "SLA Deadline",
                "SLA Breached",
                "Escalated",
                "Escalation Level",
                "Escalation Reason",
                "Updated At"
        );

        scopedIssues.forEach(issue -> csv.row(
                safe(issue.getId()),
                issue.getTitle(),
                safeEnum(issue.getCategory()),
                safeEnum(issue.getStatus()),
                safeEnum(issue.getSeverity()),
                issue.getAddress(),
                safeEnum(issue.getAssignedDepartment()),
                safeUserName(issue.getAssignedTo()),
                safe(issue.getAssignedAt()),
                safe(issue.getSlaDeadline()),
                String.valueOf(isSlaBreached(issue)),
                String.valueOf(isEscalated(issue)),
                issue.getEscalationLevel(),
                safeEnum(issue.getEscalationReason()),
                safe(issue.getUpdatedAt())
        ));

        return csv.build();
    }

    @Transactional(readOnly = true)
    public String exportSupervisorSlaQueue() {
        User currentUser = getCurrentUser();
        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser)
                .stream()
                .filter(this::isActiveOperationalIssue)
                .filter(issue -> isSlaBreached(issue) || isEscalated(issue))
                .sorted(compareIssueRiskThenUpdated())
                .toList();

        CsvBuilder csv = new CsvBuilder();

        csv.row(
                "Issue ID",
                "Title",
                "Category",
                "Status",
                "Severity",
                "Address",
                "Department",
                "Assigned Worker",
                "SLA Deadline",
                "SLA Breached",
                "Escalated",
                "Escalation Level",
                "Escalation Reason",
                "Escalated At",
                "Escalated By",
                "Updated At"
        );

        scopedIssues.forEach(issue -> csv.row(
                safe(issue.getId()),
                issue.getTitle(),
                safeEnum(issue.getCategory()),
                safeEnum(issue.getStatus()),
                safeEnum(issue.getSeverity()),
                issue.getAddress(),
                safeEnum(issue.getAssignedDepartment()),
                safeUserName(issue.getAssignedTo()),
                safe(issue.getSlaDeadline()),
                String.valueOf(isSlaBreached(issue)),
                String.valueOf(isEscalated(issue)),
                issue.getEscalationLevel(),
                safeEnum(issue.getEscalationReason()),
                safe(issue.getEscalatedAt()),
                safeUserName(issue.getEscalatedBy()),
                safe(issue.getUpdatedAt())
        ));

        return csv.build();
    }

    @Transactional(readOnly = true)
    public String exportSupervisorWorkerWorkload() {
        User currentUser = getCurrentUser();

        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser);
        List<User> staff = getSupervisorScopedStaff(currentUser);

        CsvBuilder csv = new CsvBuilder();

        csv.row(
                "Worker ID",
                "Worker Name",
                "Worker Email",
                "Role",
                "Departments",
                "Assigned Count",
                "In Progress Count",
                "Pending Closure Count",
                "Resolved Count",
                "SLA Breached Count",
                "Escalated Count",
                "Total Active Count"
        );

        staff.stream()
                .sorted(Comparator.comparing(User::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .forEach(worker -> {
                    List<Issue> workerIssues = scopedIssues.stream()
                            .filter(issue -> issue.getAssignedTo() != null)
                            .filter(issue -> issue.getAssignedTo().getId().equals(worker.getId()))
                            .toList();

                    csv.row(
                            safe(worker.getId()),
                            worker.getName(),
                            worker.getEmail(),
                            safeEnum(worker.getRole()),
                            String.join(" | ", getWorkerDepartments(worker.getId())),
                            String.valueOf(countByStatus(workerIssues, IssueStatus.ASSIGNED)),
                            String.valueOf(countByStatus(workerIssues, IssueStatus.IN_PROGRESS)),
                            String.valueOf(countByStatus(workerIssues, IssueStatus.PENDING_CLOSURE)),
                            String.valueOf(countByStatus(workerIssues, IssueStatus.RESOLVED)),
                            String.valueOf(workerIssues.stream().filter(this::isSlaBreached).count()),
                            String.valueOf(workerIssues.stream().filter(this::isEscalated).count()),
                            String.valueOf(workerIssues.stream().filter(this::isActiveOperationalIssue).count())
                    );
                });

        return csv.build();
    }

    @Transactional(readOnly = true)
    public String exportSupervisorDepartmentWorkload() {
        User currentUser = getCurrentUser();
        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser);
        List<Department> departments = resolveSupervisorDepartments(currentUser);

        CsvBuilder csv = new CsvBuilder();

        csv.row(
                "Department",
                "Assigned Count",
                "In Progress Count",
                "Pending Closure Count",
                "Resolved Count",
                "SLA Breached Count",
                "Escalated Count",
                "Total Active Count"
        );

        departments.stream()
                .sorted(Comparator.comparing(Enum::name))
                .forEach(department -> {
                    List<Issue> departmentIssues = scopedIssues.stream()
                            .filter(issue -> issue.getAssignedDepartment() == department)
                            .toList();

                    csv.row(
                            safeEnum(department),
                            String.valueOf(countByStatus(departmentIssues, IssueStatus.ASSIGNED)),
                            String.valueOf(countByStatus(departmentIssues, IssueStatus.IN_PROGRESS)),
                            String.valueOf(countByStatus(departmentIssues, IssueStatus.PENDING_CLOSURE)),
                            String.valueOf(countByStatus(departmentIssues, IssueStatus.RESOLVED)),
                            String.valueOf(departmentIssues.stream().filter(this::isSlaBreached).count()),
                            String.valueOf(departmentIssues.stream().filter(this::isEscalated).count()),
                            String.valueOf(departmentIssues.stream().filter(this::isActiveOperationalIssue).count())
                    );
                });

        return csv.build();
    }

    private List<Issue> getSupervisorScopedIssues(User currentUser) {
        List<Issue> allIssues = issueRepository.findAll();

        if (currentUser.getRole() == UserRole.ADMIN) {
            return allIssues;
        }

        List<Department> departments = resolveSupervisorDepartments(currentUser);

        if (departments.isEmpty()) {
            return List.of();
        }

        return allIssues.stream()
                .filter(issue -> issue.getAssignedDepartment() != null)
                .filter(issue -> departments.contains(issue.getAssignedDepartment()))
                .toList();
    }

    private List<User> getSupervisorScopedStaff(User currentUser) {
        List<User> staff = userRepository.findByRoleIn(
                List.of(UserRole.WORKER, UserRole.OFFICER, UserRole.SUPERVISOR)
        );

        if (currentUser.getRole() == UserRole.ADMIN) {
            return staff;
        }

        List<Department> departments = resolveSupervisorDepartments(currentUser);

        if (departments.isEmpty()) {
            return List.of();
        }

        Set<UUID> staffIds = departments.stream()
                .flatMap(department -> workerDepartmentRepository.findByDepartment(department).stream())
                .map(WorkerDepartment::getWorker)
                .filter(Objects::nonNull)
                .map(User::getId)
                .collect(Collectors.toSet());

        return staff.stream()
                .filter(user -> staffIds.contains(user.getId()))
                .toList();
    }

    private List<Department> resolveSupervisorDepartments(User currentUser) {
        if (currentUser == null) {
            return List.of();
        }

        if (currentUser.getRole() == UserRole.ADMIN) {
            return List.of(Department.values());
        }

        return workerDepartmentRepository.findByWorkerId(currentUser.getId())
                .stream()
                .map(WorkerDepartment::getDepartment)
                .filter(Objects::nonNull)
                .distinct()
                .sorted(Comparator.comparing(Enum::name))
                .toList();
    }

    private List<String> getWorkerDepartments(UUID workerId) {
        if (workerId == null) {
            return List.of();
        }

        return workerDepartmentRepository.findByWorkerId(workerId)
                .stream()
                .map(WorkerDepartment::getDepartment)
                .filter(Objects::nonNull)
                .map(Enum::name)
                .sorted()
                .toList();
    }

    private boolean isActiveOperationalIssue(Issue issue) {
        if (issue == null || issue.getStatus() == null) {
            return false;
        }

        return issue.getStatus() == IssueStatus.ASSIGNED ||
                issue.getStatus() == IssueStatus.IN_PROGRESS ||
                issue.getStatus() == IssueStatus.PENDING_CLOSURE;
    }

    private boolean isSlaBreached(Issue issue) {
        if (issue == null) {
            return false;
        }

        if (Boolean.TRUE.equals(issue.getSlaBreached())) {
            return true;
        }

        if (!isActiveOperationalIssue(issue)) {
            return false;
        }

        LocalDateTime deadline = issue.getSlaDeadline();

        return deadline != null && LocalDateTime.now().isAfter(deadline);
    }

    private boolean isEscalated(Issue issue) {
        if (issue == null) {
            return false;
        }

        return issue.getEscalationReason() != null ||
                issue.getEscalatedAt() != null ||
                Boolean.TRUE.equals(issue.getSlaBreached());
    }

    private long countByStatus(List<Issue> issues, IssueStatus status) {
        return issues.stream()
                .filter(issue -> issue.getStatus() == status)
                .count();
    }

    private Comparator<Issue> compareByUpdatedAtDesc() {
        return (first, second) -> {
            LocalDateTime firstDate = first.getUpdatedAt() == null
                    ? first.getCreatedAt()
                    : first.getUpdatedAt();

            LocalDateTime secondDate = second.getUpdatedAt() == null
                    ? second.getCreatedAt()
                    : second.getUpdatedAt();

            if (firstDate == null && secondDate == null) {
                return 0;
            }

            if (firstDate == null) {
                return 1;
            }

            if (secondDate == null) {
                return -1;
            }

            return secondDate.compareTo(firstDate);
        };
    }

    private Comparator<Issue> compareIssueRiskThenUpdated() {
        return (first, second) -> {
            boolean firstBreached = isSlaBreached(first);
            boolean secondBreached = isSlaBreached(second);

            if (firstBreached && !secondBreached) {
                return -1;
            }

            if (!firstBreached && secondBreached) {
                return 1;
            }

            LocalDateTime firstDeadline = first.getSlaDeadline();
            LocalDateTime secondDeadline = second.getSlaDeadline();

            if (firstDeadline != null && secondDeadline != null) {
                int deadlineCompare = firstDeadline.compareTo(secondDeadline);

                if (deadlineCompare != 0) {
                    return deadlineCompare;
                }
            }

            if (firstDeadline == null && secondDeadline != null) {
                return 1;
            }

            if (firstDeadline != null) {
                return -1;
            }

            return compareByUpdatedAtDesc().compare(first, second);
        };
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safeEnum(Enum<?> value) {
        return value == null ? "" : value.name();
    }

    private String safeUserName(User user) {
        if (user == null) {
            return "";
        }

        if (user.getName() != null && !user.getName().isBlank()) {
            return user.getName();
        }

        return user.getEmail() == null ? "" : user.getEmail();
    }

    private String safeUserEmail(User user) {
        return user == null || user.getEmail() == null ? "" : user.getEmail();
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || authentication.getPrincipal() == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof CustomUserDetails customUserDetails) {
            return customUserDetails.getUser();
        }

        throw new RuntimeException("Invalid authenticated user");
    }

    private static class CsvBuilder {

        private final StringBuilder builder = new StringBuilder();

        void row(String... values) {
            for (int index = 0; index < values.length; index++) {
                if (index > 0) {
                    builder.append(',');
                }

                builder.append(escape(values[index]));
            }

            builder.append('\n');
        }

        String build() {
            return builder.toString();
        }

        private String escape(String value) {
            if (value == null) {
                return "";
            }

            String normalized = value
                    .replace("\r\n", "\n")
                    .replace("\r", "\n");

            boolean mustQuote =
                    normalized.contains(",") ||
                            normalized.contains("\n") ||
                            normalized.contains("\"");

            String escaped = normalized.replace("\"", "\"\"");

            if (mustQuote) {
                return "\"" + escaped + "\"";
            }

            return escaped;
        }
    }
}

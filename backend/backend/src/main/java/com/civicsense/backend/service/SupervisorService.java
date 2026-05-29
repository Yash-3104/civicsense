package com.civicsense.backend.service;

import com.civicsense.backend.dto.*;
import com.civicsense.backend.entity.*;
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
public class SupervisorService {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;
    private final IssueActivityService issueActivityService;
    private final NotificationService notificationService;

    public SupervisorOverviewResponse getOverview() {
        User currentUser = getCurrentUser();

        List<Department> supervisorDepartments = resolveSupervisorDepartments(currentUser);

        List<Issue> scopedIssues = filterIssuesForSupervisorDepartments(
                issueRepository.findAll(),
                supervisorDepartments,
                currentUser
        );

        List<Issue> activeIssues = scopedIssues.stream()
                .filter(this::isActiveOperationalIssue)
                .toList();

        List<Issue> supervisorVisibleIssues = scopedIssues.stream()
                .filter(this::isSupervisorVisibleTaskIssue)
                .toList();

        List<User> scopedStaff = getStaffForSupervisorDepartments(
                supervisorDepartments,
                currentUser
        );

        List<SupervisorIssueQueueItem> taskQueue = supervisorVisibleIssues.stream()
                .sorted(this::compareTaskPriority)
                .map(this::mapToQueueItem)
                .toList();

        List<SupervisorIssueQueueItem> slaQueue = activeIssues.stream()
                .filter(issue -> isSlaBreached(issue) || isEscalated(issue))
                .sorted(this::compareIssueRisk)
                .map(this::mapToQueueItem)
                .toList();

        List<WorkerWorkloadResponse> workerWorkloads = scopedStaff.stream()
                .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
                .map(worker -> buildWorkerWorkload(worker, scopedIssues))
                .toList();

        List<DepartmentWorkloadResponse> departmentWorkloads = supervisorDepartments.stream()
                .map(department -> buildDepartmentWorkload(department, scopedIssues))
                .filter(workload -> workload.getTotalActiveCount() > 0)
                .sorted(
                        Comparator
                                .comparing(DepartmentWorkloadResponse::getSlaBreachedCount)
                                .reversed()
                                .thenComparing(
                                        DepartmentWorkloadResponse::getTotalActiveCount,
                                        Comparator.reverseOrder()
                                )
                )
                .toList();

        return SupervisorOverviewResponse.builder()
                .supervisorDepartments(
                        supervisorDepartments.stream()
                                .map(Enum::name)
                                .sorted()
                                .toList()
                )
                .activeIssues((long) activeIssues.size())
                .assignedIssues(countByStatus(scopedIssues, IssueStatus.ASSIGNED))
                .inProgressIssues(countByStatus(scopedIssues, IssueStatus.IN_PROGRESS))
                .pendingClosureIssues(countByStatus(scopedIssues, IssueStatus.PENDING_CLOSURE))
                .resolvedIssues(countByStatus(scopedIssues, IssueStatus.RESOLVED))
                .slaBreachedIssues(activeIssues.stream().filter(this::isSlaBreached).count())
                .escalatedIssues(activeIssues.stream().filter(this::isEscalated).count())
                .activeWorkers(workerWorkloads.stream().filter(w -> w.getTotalActiveCount() > 0).count())
                .taskQueue(taskQueue)
                .slaQueue(slaQueue)
                .workerWorkloads(workerWorkloads)
                .departmentWorkloads(departmentWorkloads)
                .build();
    }

    @Transactional
    public void addSupervisorNote(UUID issueId, SupervisorNoteRequest request) {
        if (request == null || request.getNote() == null || request.getNote().isBlank()) {
            throw new RuntimeException("Supervisor note is required");
        }

        String note = request.getNote().trim();

        User currentUser = getCurrentUser();

        boolean canAddNote =
                currentUser.getRole() == UserRole.ADMIN ||
                        currentUser.getRole() == UserRole.SUPERVISOR ||
                        currentUser.getRole() == UserRole.OFFICER;

        if (!canAddNote) {
            throw new RuntimeException("Only admin, supervisor, or officer can add supervisor notes");
        }

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateUserCanAccessIssueDepartment(currentUser, issue);

        issueActivityService.recordActivity(
                issue,
                IssueActivityType.SUPERVISOR_NOTE,
                "Supervisor note: " + note,
                currentUser
        );

        notificationService.notifySupervisorNoteAdded(issue, currentUser);
    }

    private void validateUserCanAccessIssueDepartment(User currentUser, Issue issue) {
        if (currentUser == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }

        if (issue == null || issue.getAssignedDepartment() == null) {
            throw new RuntimeException("Issue is not assigned to a supervisor-managed department");
        }

        List<Department> supervisorDepartments = resolveSupervisorDepartments(currentUser);

        if (!supervisorDepartments.contains(issue.getAssignedDepartment())) {
            throw new RuntimeException("You can only add notes to issues in your mapped departments");
        }
    }

    private List<Issue> filterIssuesForSupervisorDepartments(List<Issue> issues, List<Department> supervisorDepartments, User currentUser) {
        if (currentUser != null && currentUser.getRole() == UserRole.ADMIN) {
            return issues;
        }

        if (supervisorDepartments == null || supervisorDepartments.isEmpty()) {
            return List.of();
        }

        return issues.stream()
                .filter(issue -> issue.getAssignedDepartment() != null)
                .filter(issue -> supervisorDepartments.contains(issue.getAssignedDepartment()))
                .toList();
    }

    private List<User> getStaffForSupervisorDepartments(List<Department> supervisorDepartments, User currentUser) {
        List<User> staff = userRepository.findByRoleIn(
                List.of(UserRole.WORKER, UserRole.OFFICER, UserRole.SUPERVISOR)
        );

        if (currentUser != null && currentUser.getRole() == UserRole.ADMIN) {
            return staff;
        }

        if (supervisorDepartments == null || supervisorDepartments.isEmpty()) {
            return List.of();
        }

        Set<UUID> staffIds = supervisorDepartments.stream()
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

    private WorkerWorkloadResponse buildWorkerWorkload(User worker, List<Issue> scopedIssues) {
        List<Issue> workerIssues = scopedIssues.stream()
                .filter(issue -> issue.getAssignedTo() != null)
                .filter(issue -> issue.getAssignedTo().getId().equals(worker.getId()))
                .toList();

        List<String> departments = workerDepartmentRepository.findByWorkerId(worker.getId())
                .stream()
                .map(WorkerDepartment::getDepartment)
                .filter(Objects::nonNull)
                .map(Enum::name)
                .sorted()
                .toList();

        return WorkerWorkloadResponse.builder()
                .workerId(worker.getId())
                .workerName(worker.getName())
                .workerEmail(worker.getEmail())
                .role(worker.getRole().name())
                .departments(departments)
                .assignedCount(countByStatus(workerIssues, IssueStatus.ASSIGNED))
                .inProgressCount(countByStatus(workerIssues, IssueStatus.IN_PROGRESS))
                .pendingClosureCount(countByStatus(workerIssues, IssueStatus.PENDING_CLOSURE))
                .resolvedCount(countByStatus(workerIssues, IssueStatus.RESOLVED))
                .slaBreachedCount(workerIssues.stream().filter(this::isSlaBreached).count())
                .escalatedCount(workerIssues.stream().filter(this::isEscalated).count())
                .totalActiveCount(workerIssues.stream().filter(this::isActiveOperationalIssue).count())
                .build();
    }

    private DepartmentWorkloadResponse buildDepartmentWorkload(Department department, List<Issue> scopedIssues) {
        List<Issue> departmentIssues = scopedIssues.stream()
                .filter(issue -> issue.getAssignedDepartment() == department)
                .toList();

        return DepartmentWorkloadResponse.builder()
                .department(department.name())
                .assignedCount(countByStatus(departmentIssues, IssueStatus.ASSIGNED))
                .inProgressCount(countByStatus(departmentIssues, IssueStatus.IN_PROGRESS))
                .pendingClosureCount(countByStatus(departmentIssues, IssueStatus.PENDING_CLOSURE))
                .resolvedCount(countByStatus(departmentIssues, IssueStatus.RESOLVED))
                .slaBreachedCount(departmentIssues.stream().filter(this::isSlaBreached).count())
                .escalatedCount(departmentIssues.stream().filter(this::isEscalated).count())
                .totalActiveCount(departmentIssues.stream().filter(this::isActiveOperationalIssue).count())
                .build();
    }

    private SupervisorIssueQueueItem mapToQueueItem(Issue issue) {
        return SupervisorIssueQueueItem.builder()
                .id(issue.getId())
                .title(issue.getTitle())
                .category(issue.getCategory() == null ? null : issue.getCategory().name())
                .status(issue.getStatus() == null ? null : issue.getStatus().name())
                .severity(issue.getSeverity() == null ? null : issue.getSeverity().name())
                .address(issue.getAddress())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .assignedTo(mapUserSummary(issue.getAssignedTo()))
                .assignedDepartment(issue.getAssignedDepartment() == null ? null : issue.getAssignedDepartment().name())
                .assignedAt(issue.getAssignedAt())
                .slaDeadline(issue.getSlaDeadline())
                .slaBreached(isSlaBreached(issue))
                .escalationReason(issue.getEscalationReason() == null ? null : issue.getEscalationReason().name())
                .escalationLevel(issue.getEscalationLevel())
                .escalatedAt(issue.getEscalatedAt())
                .escalatedBy(mapUserSummary(issue.getEscalatedBy()))
                .updatedAt(issue.getUpdatedAt())
                .resolvedAt(issue.getResolvedAt())
                .build();
    }

    private Long countByStatus(List<Issue> issues, IssueStatus status) {
        return issues.stream().filter(issue -> issue.getStatus() == status).count();
    }

    private boolean isActiveOperationalIssue(Issue issue) {
        if (issue == null || issue.getStatus() == null) return false;
        return issue.getStatus() == IssueStatus.ASSIGNED ||
                issue.getStatus() == IssueStatus.IN_PROGRESS ||
                issue.getStatus() == IssueStatus.PENDING_CLOSURE;
    }

    private boolean isSupervisorVisibleTaskIssue(Issue issue) {
        if (issue == null || issue.getStatus() == null) return false;
        return isActiveOperationalIssue(issue) ||
                issue.getStatus() == IssueStatus.RESOLVED;
    }

    private boolean isEscalated(Issue issue) {
        if (issue == null) return false;
        return issue.getEscalationReason() != null ||
                issue.getEscalatedAt() != null ||
                Boolean.TRUE.equals(issue.getSlaBreached());
    }

    private boolean isSlaBreached(Issue issue) {
        if (issue == null) return false;
        if (Boolean.TRUE.equals(issue.getSlaBreached())) return true;
        if (!isActiveOperationalIssue(issue)) return false;

        LocalDateTime deadline = issue.getSlaDeadline();
        return deadline != null && LocalDateTime.now().isAfter(deadline);
    }

    private int compareTaskPriority(Issue first, Issue second) {
        int riskCompare = compareIssueRisk(first, second);

        if (riskCompare != 0) {
            return riskCompare;
        }

        int statusCompare = Integer.compare(statusPriority(first), statusPriority(second));

        if (statusCompare != 0) {
            return statusCompare;
        }

        LocalDateTime firstUpdated = first.getUpdatedAt();
        LocalDateTime secondUpdated = second.getUpdatedAt();

        if (firstUpdated == null && secondUpdated == null) return 0;
        if (firstUpdated == null) return 1;
        if (secondUpdated == null) return -1;

        return secondUpdated.compareTo(firstUpdated);
    }

    private int statusPriority(Issue issue) {
        if (issue == null || issue.getStatus() == null) return 99;

        return switch (issue.getStatus()) {
            case PENDING_CLOSURE -> 1;
            case IN_PROGRESS -> 2;
            case ASSIGNED -> 3;
            default -> 99;
        };
    }

    private int compareIssueRisk(Issue first, Issue second) {
        boolean firstBreached = isSlaBreached(first);
        boolean secondBreached = isSlaBreached(second);

        if (firstBreached && !secondBreached) return -1;
        if (!firstBreached && secondBreached) return 1;

        LocalDateTime firstDeadline = first.getSlaDeadline();
        LocalDateTime secondDeadline = second.getSlaDeadline();

        if (firstDeadline == null && secondDeadline == null) return 0;
        if (firstDeadline == null) return 1;
        if (secondDeadline == null) return -1;

        return firstDeadline.compareTo(secondDeadline);
    }

    private UserSummary mapUserSummary(User user) {
        if (user == null) return null;
        return UserSummary.builder()
                .id(user.getId())
                .name(user.getName())
                .build();
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
}

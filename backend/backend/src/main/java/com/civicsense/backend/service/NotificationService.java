package com.civicsense.backend.service;

import com.civicsense.backend.dto.NotificationResponse;
import com.civicsense.backend.entity.AppNotification;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.NotificationType;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.entity.WorkerDepartment;
import com.civicsense.backend.repository.NotificationRepository;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.repository.WorkerDepartmentRepository;
import com.civicsense.backend.security.CustomUserDetails;
import com.civicsense.backend.util.DepartmentRouting;

import lombok.RequiredArgsConstructor;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications() {
        User currentUser = getCurrentUser();

        return notificationRepository.findTop20ByRecipientIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getMyUnreadCount() {
        User currentUser = getCurrentUser();

        return notificationRepository.countByRecipientIdAndReadAtIsNull(currentUser.getId());
    }

    @Transactional
    public NotificationResponse markAsRead(UUID notificationId) {
        User currentUser = getCurrentUser();

        AppNotification notification = notificationRepository
                .findByIdAndRecipientId(notificationId, currentUser.getId())
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }

        return mapToResponse(notificationRepository.save(notification));
    }

    @Transactional
    public void markAllAsRead() {
        User currentUser = getCurrentUser();

        List<AppNotification> unreadNotifications =
                notificationRepository.findByRecipientIdAndReadAtIsNull(currentUser.getId());

        LocalDateTime now = LocalDateTime.now();

        unreadNotifications.forEach(notification -> notification.setReadAt(now));

        notificationRepository.saveAll(unreadNotifications);
    }

    @Transactional
    public long clearReadNotifications() {
        User currentUser = getCurrentUser();

        List<AppNotification> readNotifications =
                notificationRepository.findByRecipientIdAndReadAtIsNotNull(currentUser.getId());

        long deletedCount = readNotifications.size();

        notificationRepository.deleteAll(readNotifications);

        return deletedCount;
    }

    @Transactional
    public void notifyAdminsNewIssue(Issue issue) {
        notifyUsersByRoles(
                List.of(UserRole.ADMIN),
                issue,
                NotificationType.ISSUE_REPORTED,
                "New civic issue reported",
                issueTitle(issue) + " was submitted by a citizen."
        );
    }

    @Transactional
    public void notifyMappedSupervisorsNewIssue(Issue issue) {
        if (issue == null || issue.getCategory() == null) {
            return;
        }

        List<Department> departments =
                DepartmentRouting.getDepartmentsForCategory(issue.getCategory());

        if (departments.isEmpty()) {
            return;
        }

        String title =
                "New issue in your mapped department";

        String message =
                departments.size() == 1
                        ? "A new " + formatEnumLabel(issue.getCategory().name()) +
                                " report may require " +
                                formatEnumLabel(departments.get(0).name()) +
                                " review."
                        : "A new " + formatEnumLabel(issue.getCategory().name()) +
                                " report may require mapped department review.";

        Set<UUID> notifiedUserIds = new HashSet<>();

        departments.forEach(department ->
                workerDepartmentRepository.findByDepartment(department)
                        .stream()
                        .map(WorkerDepartment::getWorker)
                        .filter(Objects::nonNull)
                        .filter(user -> user.getRole() == UserRole.SUPERVISOR)
                        .filter(user -> user.getId() != null)
                        .filter(user -> notifiedUserIds.add(user.getId()))
                        .forEach(user ->
                                createForUser(
                                        user,
                                        issue,
                                        NotificationType.ISSUE_REPORTED,
                                        title,
                                        message
                                )
                        )
        );
    }

    @Transactional
    public void notifyIssueStatusChanged(Issue issue) {
        if (issue == null || issue.getStatus() == null) {
            return;
        }

        switch (issue.getStatus()) {
            case VERIFIED -> notifyCitizen(
                    issue,
                    NotificationType.ISSUE_VERIFIED,
                    "Your report was verified",
                    issueTitle(issue) + " was verified by the operations team."
            );

            case REJECTED -> notifyCitizen(
                    issue,
                    NotificationType.ISSUE_REJECTED,
                    "Your report was rejected",
                    issueTitle(issue) + " was rejected. Check the report details for the reason."
            );

            case RESOLVED -> notifyCitizen(
                    issue,
                    NotificationType.ISSUE_RESOLVED,
                    "Your report was resolved",
                    issueTitle(issue) + " was resolved. You can now submit resolution feedback."
            );

            default -> {
                // V1 intentionally ignores routine status changes to avoid notification noise.
            }
        }
    }

    @Transactional
    public void notifyIssueAssigned(Issue issue, User assignedUser) {
        createForUser(
                assignedUser,
                issue,
                NotificationType.ISSUE_ASSIGNED,
                "Issue assigned to you",
                issueTitle(issue) + " was assigned to you."
        );
    }

    @Transactional
    public void notifyClosureSubmitted(Issue issue) {
        notifyUsersByRoles(
                List.of(UserRole.ADMIN),
                issue,
                NotificationType.CLOSURE_SUBMITTED,
                "Closure submitted for review",
                issueTitle(issue) + " has resolution evidence waiting for review."
        );

        notifyDepartmentSupervisors(
                issue,
                NotificationType.CLOSURE_SUBMITTED,
                "Closure submitted in your department",
                issueTitle(issue) + " is waiting for closure review."
        );
    }

    @Transactional
    public void notifyIssueEscalated(Issue issue) {
        notifyUsersByRoles(
                List.of(UserRole.ADMIN),
                issue,
                NotificationType.ISSUE_ESCALATED,
                "Issue escalated",
                issueTitle(issue) + " has been escalated."
        );

        notifyDepartmentSupervisors(
                issue,
                NotificationType.ISSUE_ESCALATED,
                "Department issue escalated",
                issueTitle(issue) + " needs supervisor attention."
        );
    }

    @Transactional
    public void notifyFeedbackSubmitted(Issue issue) {
        notifyUsersByRoles(
                List.of(UserRole.ADMIN),
                issue,
                NotificationType.FEEDBACK_SUBMITTED,
                "Citizen feedback submitted",
                "Citizen feedback was submitted for " + issueTitle(issue) + "."
        );

        notifyDepartmentSupervisors(
                issue,
                NotificationType.FEEDBACK_SUBMITTED,
                "Feedback submitted in your department",
                "Citizen feedback was submitted for " + issueTitle(issue) + "."
        );
    }

    @Transactional
    public void notifySupervisorNoteAdded(Issue issue, User actor) {
        notifyUsersByRoles(
                List.of(UserRole.ADMIN),
                issue,
                NotificationType.SUPERVISOR_NOTE,
                "Supervisor note added",
                safeUserName(actor) + " added a note on " + issueTitle(issue) + "."
        );
    }

    private void notifyCitizen(
            Issue issue,
            NotificationType type,
            String title,
            String message
    ) {
        if (issue == null || issue.getReportedBy() == null) {
            return;
        }

        createForUser(issue.getReportedBy(), issue, type, title, message);
    }

    private void notifyUsersByRoles(
            List<UserRole> roles,
            Issue issue,
            NotificationType type,
            String title,
            String message
    ) {
        userRepository.findByRoleIn(roles)
                .forEach(user -> createForUser(user, issue, type, title, message));
    }

    private void notifyDepartmentSupervisors(
            Issue issue,
            NotificationType type,
            String title,
            String message
    ) {
        if (issue == null || issue.getAssignedDepartment() == null) {
            return;
        }

        Department department = issue.getAssignedDepartment();

        workerDepartmentRepository.findByDepartment(department)
                .stream()
                .map(WorkerDepartment::getWorker)
                .filter(Objects::nonNull)
                .filter(user ->
                        user.getRole() == UserRole.SUPERVISOR ||
                                user.getRole() == UserRole.OFFICER
                )
                .forEach(user -> createForUser(user, issue, type, title, message));
    }

    private void createForUser(
            User recipient,
            Issue issue,
            NotificationType type,
            String title,
            String message
    ) {
        if (recipient == null || recipient.getId() == null || type == null) {
            return;
        }

        AppNotification notification = AppNotification.builder()
                .recipient(recipient)
                .issue(issue)
                .type(type)
                .title(title)
                .message(message)
                .createdAt(LocalDateTime.now())
                .build();

        AppNotification savedNotification = notificationRepository.save(notification);
        publishRealtimeNotification(savedNotification);
    }

    private NotificationResponse mapToResponse(AppNotification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .issueId(
                        notification.getIssue() == null
                                ? null
                                : notification.getIssue().getId()
                )
                .type(
                        notification.getType() == null
                                ? null
                                : notification.getType().name()
                )
                .title(notification.getTitle())
                .message(notification.getMessage())
                .actionUrl(buildActionUrl(notification))
                .read(notification.getReadAt() != null)
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }


    private void publishRealtimeNotification(AppNotification notification) {
        if (notification == null || notification.getRecipient() == null) {
            return;
        }

        NotificationResponse response = mapToResponse(notification);

        messagingTemplate.convertAndSend(
                "/topic/notifications/" + notification.getRecipient().getId(),
                response
        );
    }

    private String buildActionUrl(AppNotification notification) {
        if (notification == null || notification.getRecipient() == null) {
            return "/";
        }

        UUID issueId = notification.getIssue() == null
                ? null
                : notification.getIssue().getId();

        UserRole role = notification.getRecipient().getRole();

        if (role == UserRole.ADMIN) {
            return issueId == null ? "/admin" : "/admin?issueId=" + issueId;
        }

        if (role == UserRole.SUPERVISOR) {
            return issueId == null ? "/supervisor" : "/supervisor?issueId=" + issueId;
        }

        if (role == UserRole.WORKER || role == UserRole.OFFICER) {
            return issueId == null ? "/worker" : "/worker?issueId=" + issueId;
        }

        if (role == UserRole.CITIZEN) {
            return issueId == null
                    ? "/dashboard?tab=my-reports"
                    : "/dashboard?tab=my-reports&reportId=" + issueId;
        }

        return "/";
    }

    private String issueTitle(Issue issue) {
        if (issue == null || issue.getTitle() == null || issue.getTitle().isBlank()) {
            return "An issue";
        }

        return issue.getTitle();
    }

    private String safeUserName(User user) {
        if (user == null) {
            return "A user";
        }

        if (user.getName() != null && !user.getName().isBlank()) {
            return user.getName();
        }

        return user.getEmail() == null ? "A user" : user.getEmail();
    }

    private String formatEnumLabel(String value) {
        if (value == null || value.isBlank()) {
            return "mapped department";
        }

        String normalized =
                value.replace("_", " ").toLowerCase();

        StringBuilder builder =
                new StringBuilder();

        for (String word : normalized.split(" ")) {
            if (word.isBlank()) {
                continue;
            }

            if (builder.length() > 0) {
                builder.append(" ");
            }

            builder.append(Character.toUpperCase(word.charAt(0)));

            if (word.length() > 1) {
                builder.append(word.substring(1));
            }
        }

        return builder.length() == 0 ? value : builder.toString();
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }
}

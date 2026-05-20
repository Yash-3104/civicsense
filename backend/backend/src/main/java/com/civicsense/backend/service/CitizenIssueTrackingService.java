package com.civicsense.backend.service;

import com.civicsense.backend.dto.CitizenReportResponse;
import com.civicsense.backend.dto.CitizenTimelineItemResponse;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueActivity;
import com.civicsense.backend.entity.IssueActivityType;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.RejectionReason;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.repository.IssueActivityRepository;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.security.CustomUserDetails;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CitizenIssueTrackingService {

    private final IssueRepository issueRepository;
    private final IssueActivityRepository issueActivityRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<CitizenReportResponse> getMyReports() {
        User citizen = getCurrentUser();

        return issueRepository.findByReportedByIdOrderByCreatedAtDesc(citizen.getId())
                .stream()
                .map(issue -> mapToCitizenReport(issue, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public CitizenReportResponse getMyReportById(UUID issueId) {
        User citizen = getCurrentUser();

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateCitizenOwnsIssue(citizen, issue);

        return mapToCitizenReport(issue, true);
    }

    @Transactional(readOnly = true)
    public List<CitizenTimelineItemResponse> getMyReportTimeline(UUID issueId) {
        User citizen = getCurrentUser();

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateCitizenOwnsIssue(citizen, issue);

        return mapCitizenTimeline(issue.getId());
    }

    private CitizenReportResponse mapToCitizenReport(
            Issue issue,
            boolean includeTimeline
    ) {
        List<String> mediaUrls = getMediaUrls(issue);

        return CitizenReportResponse.builder()
                .id(issue.getId())
                .title(issue.getTitle())
                .description(issue.getDescription())
                .category(issue.getCategory() == null ? null : issue.getCategory().name())
                .status(issue.getStatus() == null ? null : issue.getStatus().name())
                .citizenStatusLabel(resolveCitizenStatusLabel(issue.getStatus()))
                .severity(issue.getSeverity() == null ? null : issue.getSeverity().name())
                .address(issue.getAddress())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .imageUrl(mediaUrls.isEmpty() ? null : mediaUrls.get(0))
                .mediaUrls(mediaUrls)
                .assignedDepartment(
                        issue.getAssignedDepartment() == null
                                ? null
                                : issue.getAssignedDepartment().name()
                )
                .assignedAt(issue.getAssignedAt())
                .slaDeadline(issue.getSlaDeadline())
                .slaBreached(isSlaBreached(issue))
                .slaStatus(resolveSlaStatus(issue))
                .slaMessage(resolveSlaMessage(issue))
                .resolutionNotes(issue.getResolutionNotes())
                .resolutionImageUrl(buildImageUrl(issue.getResolutionImageUrl()))
                .resolvedAt(issue.getResolvedAt())
                .rejectionReason(
                        issue.getRejectionReason() == null
                                ? null
                                : issue.getRejectionReason().name()
                )
                .rejectionReasonLabel(formatRejectionReason(issue.getRejectionReason()))
                .rejectionNotes(issue.getRejectionNotes())
                .rejectedAt(issue.getRejectedAt())
                .timeline(
                        includeTimeline
                                ? mapCitizenTimeline(issue.getId())
                                : List.of()
                )
                .build();
    }

    private List<CitizenTimelineItemResponse> mapCitizenTimeline(UUID issueId) {
        return issueActivityRepository.findByIssueIdOrderByCreatedAtAsc(issueId)
                .stream()
                .filter(this::isCitizenVisibleActivity)
                .map(this::mapTimelineItem)
                .toList();
    }

    private boolean isCitizenVisibleActivity(IssueActivity activity) {
        if (activity == null || activity.getType() == null) {
            return false;
        }

        return switch (activity.getType()) {
            case ISSUE_CREATED,
                    AI_ANALYSIS_COMPLETED,
                    ISSUE_VERIFIED,
                    ISSUE_REJECTED,
                    ISSUE_ASSIGNED,
                    WORK_STARTED,
                    CLOSURE_SUBMITTED,
                    CLOSURE_APPROVED,
                    ISSUE_SENT_BACK,
                    ISSUE_ESCALATED,
                    STATUS_CHANGED -> true;

            // Hide internal-only media/admin/supervisor/delete events from citizen tracking.
            case IMAGE_UPLOADED,
                    SUPERVISOR_NOTE,
                    ISSUE_DELETED -> false;
        };
    }

    private CitizenTimelineItemResponse mapTimelineItem(IssueActivity activity) {
        String type = activity.getType().name();

        return CitizenTimelineItemResponse.builder()
                .id(activity.getId())
                .type(type)
                .title(resolveCitizenTimelineTitle(activity.getType()))
                .message(resolveCitizenTimelineMessage(activity))
                .createdAt(activity.getCreatedAt())
                .build();
    }

    private String resolveCitizenTimelineTitle(IssueActivityType type) {
        if (type == null) {
            return "Update";
        }

        return switch (type) {
            case ISSUE_CREATED -> "Report submitted";
            case AI_ANALYSIS_COMPLETED -> "AI review completed";
            case ISSUE_VERIFIED -> "Report verified";
            case ISSUE_REJECTED -> "Report rejected";
            case ISSUE_ASSIGNED -> "Assigned to operations";
            case WORK_STARTED -> "Work started";
            case CLOSURE_SUBMITTED -> "Resolution submitted";
            case CLOSURE_APPROVED -> "Issue resolved";
            case ISSUE_SENT_BACK -> "Resolution sent back for more work";
            case ISSUE_ESCALATED -> "Issue escalated";
            case STATUS_CHANGED -> "Status updated";
            default -> "Update";
        };
    }

    private String resolveCitizenTimelineMessage(IssueActivity activity) {
        if (activity == null || activity.getType() == null) {
            return "Your report was updated.";
        }

        return switch (activity.getType()) {
            case ISSUE_CREATED -> "Your civic issue report was submitted successfully.";
            case AI_ANALYSIS_COMPLETED -> "The report was reviewed by automated verification.";
            case ISSUE_VERIFIED -> "The operations team verified your report.";
            case ISSUE_REJECTED -> "The report could not be accepted. Check the rejection reason below.";
            case ISSUE_ASSIGNED -> "The issue was assigned to the relevant department.";
            case WORK_STARTED -> "A field worker started work on this issue.";
            case CLOSURE_SUBMITTED -> "Resolution evidence was submitted and is waiting for final review.";
            case CLOSURE_APPROVED -> "The issue was closed after resolution evidence was reviewed.";
            case ISSUE_SENT_BACK -> "The resolution was sent back for additional work.";
            case ISSUE_ESCALATED -> "The issue was escalated because it needs extra attention.";
            case STATUS_CHANGED -> "The issue status was updated.";
            default -> "Your report was updated.";
        };
    }

    private void validateCitizenOwnsIssue(User citizen, Issue issue) {
        if (citizen == null || issue == null || issue.getReportedBy() == null) {
            throw new RuntimeException("You can only view your own reports");
        }

        if (!issue.getReportedBy().getId().equals(citizen.getId())) {
            throw new RuntimeException("You can only view your own reports");
        }
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

    private String resolveCitizenStatusLabel(IssueStatus status) {
        if (status == null) {
            return "Submitted";
        }

        return switch (status) {
            case REPORTED -> "Submitted";
            case VERIFIED -> "Verified";
            case ASSIGNED -> "Assigned to department";
            case IN_PROGRESS -> "Work in progress";
            case PENDING_CLOSURE -> "Waiting for final review";
            case RESOLVED -> "Resolved";
            case REJECTED -> "Rejected";
        };
    }

    private String resolveSlaStatus(Issue issue) {
        if (issue == null || issue.getStatus() == null) {
            return "NOT_STARTED";
        }

        if (issue.getStatus() == IssueStatus.RESOLVED) {
            return "RESOLVED";
        }

        if (issue.getStatus() == IssueStatus.REJECTED) {
            return "NOT_APPLICABLE";
        }

        if (issue.getSlaDeadline() == null) {
            return "NOT_STARTED";
        }

        if (isSlaBreached(issue)) {
            return "DELAYED";
        }

        Duration remaining = Duration.between(
                LocalDateTime.now(),
                issue.getSlaDeadline()
        );

        if (!remaining.isNegative() && remaining.toHours() <= 24) {
            return "DUE_SOON";
        }

        return "ON_TRACK";
    }

    private String resolveSlaMessage(Issue issue) {
        String slaStatus = resolveSlaStatus(issue);

        return switch (slaStatus) {
            case "RESOLVED" -> "Resolved and closed.";
            case "NOT_APPLICABLE" -> "SLA is not applicable for rejected reports.";
            case "NOT_STARTED" -> "SLA tracking starts after the issue is assigned.";
            case "DELAYED" -> "Delayed beyond the expected service deadline.";
            case "DUE_SOON" -> "Due soon. The operations team is expected to act shortly.";
            case "ON_TRACK" -> "On track within the expected service deadline.";
            default -> "SLA status is currently unavailable.";
        };
    }

    private boolean isSlaBreached(Issue issue) {
        if (issue == null) {
            return false;
        }

        if (Boolean.TRUE.equals(issue.getSlaBreached())) {
            return true;
        }

        if (
                issue.getStatus() != IssueStatus.ASSIGNED &&
                        issue.getStatus() != IssueStatus.IN_PROGRESS &&
                        issue.getStatus() != IssueStatus.PENDING_CLOSURE
        ) {
            return false;
        }

        return issue.getSlaDeadline() != null &&
                LocalDateTime.now().isAfter(issue.getSlaDeadline());
    }

    private String formatRejectionReason(RejectionReason reason) {
        if (reason == null) {
            return null;
        }

        return switch (reason) {
            case FAKE_REPORT -> "Fake report";
            case DUPLICATE_ISSUE -> "Duplicate issue";
            case UNCLEAR_IMAGE -> "Unclear image";
            case INVALID_CATEGORY -> "Invalid category";
            case OUTSIDE_SERVICE_AREA -> "Outside service area";
            case SPAM -> "Spam";
            case OTHER -> "Other";
        };
    }

    private List<String> getMediaUrls(Issue issue) {
        if (
                issue == null ||
                        issue.getMedia() == null ||
                        issue.getMedia().isEmpty()
        ) {
            return List.of();
        }

        return issue.getMedia()
                .stream()
                .map(media -> buildImageUrl(media.getMediaUrl()))
                .filter(url -> url != null && !url.isBlank())
                .toList();
    }

    private String buildImageUrl(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.isBlank()) {
            return null;
        }

        if (
                mediaUrl.startsWith("http://") ||
                        mediaUrl.startsWith("https://")
        ) {
            return mediaUrl;
        }

        return "http://localhost:8031/uploads/" + mediaUrl;
    }
}

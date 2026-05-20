package com.civicsense.backend.service;

import com.civicsense.backend.dto.PublicBreakdownItem;
import com.civicsense.backend.dto.PublicIssueSummary;
import com.civicsense.backend.dto.PublicTransparencyResponse;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueCategory;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.repository.IssueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PublicTransparencyService {

    private final IssueRepository issueRepository;

    public PublicTransparencyResponse getTransparencyOverview() {
        List<Issue> issues = issueRepository.findAll();

        List<PublicIssueSummary> publicIssues = issues.stream()
                .sorted(
                        Comparator
                                .comparing(Issue::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                                .reversed()
                )
                .map(this::mapToPublicIssueSummary)
                .toList();

        long totalReports = issues.size();
        long resolvedIssues = countByStatus(issues, IssueStatus.RESOLVED);
        long rejectedIssues = countByStatus(issues, IssueStatus.REJECTED);
        long pendingClosureIssues = countByStatus(issues, IssueStatus.PENDING_CLOSURE);

        long activeIssues = issues.stream()
                .filter(this::isPublicActiveIssue)
                .count();

        long slaBreachedIssues = issues.stream()
                .filter(this::isSlaBreached)
                .count();

        long escalatedIssues = issues.stream()
                .filter(this::isEscalated)
                .count();

        return PublicTransparencyResponse.builder()
                .totalReports(totalReports)
                .activeIssues(activeIssues)
                .resolvedIssues(resolvedIssues)
                .rejectedIssues(rejectedIssues)
                .pendingClosureIssues(pendingClosureIssues)
                .slaBreachedIssues(slaBreachedIssues)
                .escalatedIssues(escalatedIssues)
                .resolutionRate(calculateRate(totalReports, resolvedIssues))
                .categoryBreakdown(buildCategoryBreakdown(issues, totalReports))
                .statusBreakdown(buildStatusBreakdown(issues, totalReports))
                .departmentBreakdown(buildDepartmentBreakdown(issues, totalReports))
                .publicIssues(publicIssues)
                .recentIssues(publicIssues.stream().limit(12).toList())
                .build();
    }

    private List<PublicBreakdownItem> buildCategoryBreakdown(List<Issue> issues, long totalReports) {
        return List.of(IssueCategory.values())
                .stream()
                .map(category -> {
                    long count = issues.stream()
                            .filter(issue -> issue.getCategory() == category)
                            .count();

                    return PublicBreakdownItem.builder()
                            .label(category.name())
                            .count(count)
                            .percentage(calculateRate(totalReports, count))
                            .build();
                })
                .filter(item -> item.getCount() > 0)
                .sorted(Comparator.comparing(PublicBreakdownItem::getCount).reversed())
                .toList();
    }

    private List<PublicBreakdownItem> buildStatusBreakdown(List<Issue> issues, long totalReports) {
        return List.of(IssueStatus.values())
                .stream()
                .map(status -> {
                    long count = countByStatus(issues, status);

                    return PublicBreakdownItem.builder()
                            .label(status.name())
                            .count(count)
                            .percentage(calculateRate(totalReports, count))
                            .build();
                })
                .filter(item -> item.getCount() > 0)
                .sorted(Comparator.comparing(PublicBreakdownItem::getCount).reversed())
                .toList();
    }

    private List<PublicBreakdownItem> buildDepartmentBreakdown(List<Issue> issues, long totalReports) {
        return List.of(Department.values())
                .stream()
                .map(department -> {
                    long count = issues.stream()
                            .filter(issue -> issue.getAssignedDepartment() == department)
                            .count();

                    return PublicBreakdownItem.builder()
                            .label(department.name())
                            .count(count)
                            .percentage(calculateRate(totalReports, count))
                            .build();
                })
                .filter(item -> item.getCount() > 0)
                .sorted(Comparator.comparing(PublicBreakdownItem::getCount).reversed())
                .toList();
    }

    private PublicIssueSummary mapToPublicIssueSummary(Issue issue) {
        return PublicIssueSummary.builder()
                .id(issue.getId())
                .title(issue.getTitle())
                .description(issue.getDescription())
                .category(issue.getCategory() == null ? null : issue.getCategory().name())
                .status(issue.getStatus() == null ? null : issue.getStatus().name())
                .severity(issue.getSeverity() == null ? null : issue.getSeverity().name())
                .address(issue.getAddress())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .imageUrl(getPrimaryImageUrl(issue))
                .resolutionImageUrl(buildImageUrl(issue.getResolutionImageUrl()))
                .assignedDepartment(issue.getAssignedDepartment() == null ? null : issue.getAssignedDepartment().name())
                .slaBreached(isSlaBreached(issue))
                .escalated(isEscalated(issue))
                .createdAt(issue.getCreatedAt())
                .resolvedAt(issue.getResolvedAt())
                .build();
    }

    private long countByStatus(List<Issue> issues, IssueStatus status) {
        return issues.stream()
                .filter(issue -> issue.getStatus() == status)
                .count();
    }

    private boolean isPublicActiveIssue(Issue issue) {
        if (issue == null || issue.getStatus() == null) {
            return false;
        }

        return issue.getStatus() == IssueStatus.REPORTED ||
                issue.getStatus() == IssueStatus.VERIFIED ||
                issue.getStatus() == IssueStatus.ASSIGNED ||
                issue.getStatus() == IssueStatus.IN_PROGRESS ||
                issue.getStatus() == IssueStatus.PENDING_CLOSURE;
    }

    private boolean isSlaBreached(Issue issue) {
        return issue != null && Boolean.TRUE.equals(issue.getSlaBreached());
    }

    private boolean isEscalated(Issue issue) {
        if (issue == null) {
            return false;
        }

        return issue.getEscalationReason() != null ||
                issue.getEscalatedAt() != null ||
                Boolean.TRUE.equals(issue.getSlaBreached());
    }

    private String getPrimaryImageUrl(Issue issue) {
        if (
                issue == null ||
                        issue.getMedia() == null ||
                        issue.getMedia().isEmpty()
        ) {
            return null;
        }

        return issue.getMedia()
                .stream()
                .map(media -> buildImageUrl(media.getMediaUrl()))
                .filter(imageUrl -> imageUrl != null && !imageUrl.isBlank())
                .findFirst()
                .orElse(null);
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

    private Double calculateRate(long total, long count) {
        if (total <= 0) {
            return 0.0;
        }

        return BigDecimal.valueOf((count * 100.0) / total)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}

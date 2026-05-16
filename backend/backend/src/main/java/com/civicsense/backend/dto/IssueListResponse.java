package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class IssueListResponse {

    private UUID id;

    private String title;

    private String category;

    private String status;

    private String severity;

    private String address;

    private LocalDateTime createdAt;

    private String imageUrl;

    private Double aiConfidenceScore;

    private Double fakeReportLikelihood;

    private Double duplicateLikelihood;

    private UUID possibleDuplicateIssueId;

    private String resolutionImageUrl;

    private LocalDateTime resolvedAt;

    private UserSummary assignedTo;

    private String assignedDepartment;

    private LocalDateTime assignedAt;

    private LocalDateTime slaDeadline;

    private Boolean slaBreached;

    private String rejectionReason;

    private LocalDateTime rejectedAt;
}
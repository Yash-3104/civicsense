package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class IssueResponse {

    private UUID id;

    private String title;

    private String description;

    private String category;

    private String status;

    private String severity;

    private Double priorityScore;

    private Double latitude;

    private Double longitude;

    private String address;

    private UserSummary reportedBy;

    private UserSummary assignedTo;

    private String assignedDepartment;

    private LocalDateTime assignedAt;

    private LocalDateTime slaDeadline;

    private Boolean slaBreached;

    private String escalationReason;

    private String escalationNotes;

    private LocalDateTime escalatedAt;

    private UserSummary escalatedBy;

    private String escalationLevel;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String imageUrl;

    private List<String> mediaUrls;

    private String aiDescription;

    private Double aiConfidenceScore;

    private Double fakeReportLikelihood;

    private Double severityConfidence;

    private Double duplicateLikelihood;

    private String aiReasoning;

    private UUID possibleDuplicateIssueId;

    private String resolutionNotes;

    private String resolutionImageUrl;

    private LocalDateTime resolvedAt;

    private String rejectionReason;

    private String rejectionNotes;

    private LocalDateTime rejectedAt;
}

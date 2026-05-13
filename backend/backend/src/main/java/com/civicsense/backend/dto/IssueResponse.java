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

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // First/main image for quick display
    private String imageUrl;

    // Future gallery support
    private List<String> mediaUrls;

    // AI-generated summary/verification text
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
}
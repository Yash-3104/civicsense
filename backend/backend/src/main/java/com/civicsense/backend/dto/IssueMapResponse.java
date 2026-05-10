package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class IssueMapResponse {

    private UUID id;

    private String title;
    private String category;
    private String status;
    private String severity;

    private Double latitude;
    private Double longitude;

    private String address;

    private String imageUrl;
    private Double aiConfidenceScore;
    private Double fakeReportLikelihood;
    private Double duplicateLikelihood;
    private UUID possibleDuplicateIssueId;
}
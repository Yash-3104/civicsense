package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PublicTransparencyResponse {
    private Long totalReports;
    private Long activeIssues;
    private Long resolvedIssues;
    private Long rejectedIssues;
    private Long pendingClosureIssues;
    private Long slaBreachedIssues;
    private Long escalatedIssues;
    private Double resolutionRate;
    private List<PublicBreakdownItem> categoryBreakdown;
    private List<PublicBreakdownItem> statusBreakdown;
    private List<PublicBreakdownItem> departmentBreakdown;

    // V1.1: full public-safe registry.
    private List<PublicIssueSummary> publicIssues;

    // Kept for backward compatibility with V1 frontend.
    private List<PublicIssueSummary> recentIssues;
}

package com.civicsense.backend.controller;

import com.civicsense.backend.dto.CitizenReportResponse;
import com.civicsense.backend.dto.CitizenTimelineItemResponse;
import com.civicsense.backend.service.CitizenIssueTrackingService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/citizen")
@RequiredArgsConstructor
public class CitizenIssueController {

    private final CitizenIssueTrackingService citizenIssueTrackingService;

    @GetMapping("/my-reports")
    public List<CitizenReportResponse> getMyReports() {
        return citizenIssueTrackingService.getMyReports();
    }

    @GetMapping("/my-reports/{issueId}")
    public CitizenReportResponse getMyReportById(
            @PathVariable UUID issueId
    ) {
        return citizenIssueTrackingService.getMyReportById(issueId);
    }

    @GetMapping("/my-reports/{issueId}/timeline")
    public List<CitizenTimelineItemResponse> getMyReportTimeline(
            @PathVariable UUID issueId
    ) {
        return citizenIssueTrackingService.getMyReportTimeline(issueId);
    }
}

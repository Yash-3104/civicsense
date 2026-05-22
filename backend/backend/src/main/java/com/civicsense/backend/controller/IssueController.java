package com.civicsense.backend.controller;

import com.civicsense.backend.dto.*;
import com.civicsense.backend.entity.*;
import com.civicsense.backend.service.IssueService;
import com.civicsense.backend.service.TimelineExportService;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
public class IssueController {

    private final IssueService issueService;
    private final TimelineExportService timelineExportService;

    @PostMapping
    public IssueResponse createIssue(@RequestBody CreateIssueRequest request) {
        return issueService.createIssue(request);
    }

    @GetMapping
    public PaginatedResponse<IssueListResponse> getIssues(
            @RequestParam(required = false) IssueCategory category,
            @RequestParam(required = false) SeverityLevel severity,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size
    ) {
        IssueFilterRequest filter = new IssueFilterRequest();
        filter.setCategory(category);
        filter.setSeverity(severity);
        filter.setStatus(status);

        return issueService.getIssues(filter, page, size);
    }

    @GetMapping("/{id}")
    public IssueResponse getIssueById(@PathVariable UUID id) {
        return issueService.getIssueById(id);
    }

    @GetMapping("/{id}/timeline")
    public List<IssueActivityResponse> getIssueTimeline(@PathVariable UUID id) {
        return issueService.getIssueTimeline(id);
    }


    @GetMapping(value = "/{id}/timeline/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportIssueTimelineCsv(@PathVariable UUID id) {
        byte[] csv = timelineExportService.exportIssueTimelineCsv(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "csv", StandardCharsets.UTF_8));
        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename("civicsense-issue-timeline-" + id + ".csv")
                        .build()
        );

        return ResponseEntity.ok().headers(headers).body(csv);
    }

    @GetMapping(
            value = "/{id}/timeline/export.xlsx",
            produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    public ResponseEntity<byte[]> exportIssueTimelineXlsx(@PathVariable UUID id) {
        byte[] xlsx = timelineExportService.exportIssueTimelineXlsx(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        );
        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename("civicsense-issue-timeline-" + id + ".xlsx")
                        .build()
        );

        return ResponseEntity.ok().headers(headers).body(xlsx);
    }

    @GetMapping("/nearby")
    public List<IssueMapResponse> getNearbyIssues(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5") double radius
    ) {
        return issueService.getNearbyIssues(lat, lng, radius);
    }

    @GetMapping("/worker/me")
    public List<IssueListResponse> getMyAssignedIssues() {
        return issueService.getMyAssignedIssues();
    }

    @GetMapping("/worker/{workerId}")
    public List<IssueListResponse> getAssignedIssuesByWorker(@PathVariable UUID workerId) {
        return issueService.getAssignedIssuesByWorker(workerId);
    }

    @PostMapping("/{id}/upload")
    public String uploadImage(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file
    ) {
        return issueService.uploadImage(id, file);
    }

    @DeleteMapping("/{id}")
    public void deleteIssue(@PathVariable UUID id) {
        issueService.deleteIssue(id);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<IssueResponse> updateIssueStatus(
            @PathVariable UUID id,
            @RequestBody UpdateIssueStatusRequest request
    ) {
        IssueResponse updatedIssue = issueService.updateIssueStatus(id, request);

        return ResponseEntity.ok(updatedIssue);
    }

    @PatchMapping("/{id}/assign")
    public ResponseEntity<IssueResponse> assignIssue(
            @PathVariable UUID id,
            @RequestBody AssignIssueRequest request
    ) {
        IssueResponse assignedIssue = issueService.assignIssue(
                id,
                request.getWorkerId(),
                request.getDepartment()
        );

        return ResponseEntity.ok(assignedIssue);
    }

    @PatchMapping("/{id}/escalate")
    public ResponseEntity<IssueResponse> escalateIssue(
            @PathVariable UUID id,
            @RequestBody(required = false) EscalateIssueRequest request
    ) {
        IssueResponse escalatedIssue = issueService.escalateIssue(id, request);

        return ResponseEntity.ok(escalatedIssue);
    }

    @PatchMapping(
            value = "/{id}/resolve",
            consumes = { MediaType.MULTIPART_FORM_DATA_VALUE }
    )
    public ResponseEntity<IssueResponse> resolveIssue(
            @PathVariable UUID id,
            @RequestParam(required = false) String resolutionNotes,
            @RequestPart(required = false) MultipartFile image
    ) {
        IssueResponse updatedIssue = issueService.resolveIssue(id, resolutionNotes, image);

        return ResponseEntity.ok(updatedIssue);
    }
}

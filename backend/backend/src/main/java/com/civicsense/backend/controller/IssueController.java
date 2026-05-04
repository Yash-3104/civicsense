package com.civicsense.backend.controller;

import com.civicsense.backend.dto.*;
import com.civicsense.backend.entity.*;
import com.civicsense.backend.service.IssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
public class IssueController {

    private final IssueService issueService;

    // ================= CREATE =================
    @PostMapping
    public IssueResponse createIssue(@RequestBody CreateIssueRequest request) {
        return issueService.createIssue(request);
    }

    // ================= GET WITH FILTERS =================
    @GetMapping
    public PaginatedResponse<IssueListResponse> getIssues(
            @RequestParam(required = false) IssueCategory category,
            @RequestParam(required = false) SeverityLevel severity,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {

        IssueFilterRequest filter = new IssueFilterRequest();
        filter.setCategory(category);
        filter.setSeverity(severity);
        filter.setStatus(status);

        return issueService.getIssues(filter, page, size);
    }

    // ================= GET BY ID =================
    @GetMapping("/{id}")
    public IssueResponse getIssueById(@PathVariable UUID id) {
        return issueService.getIssueById(id);
    }
    @GetMapping("/nearby")
    public List<IssueMapResponse> getNearbyIssues(
        @RequestParam double lat,
        @RequestParam double lng,
        @RequestParam(defaultValue = "5") double radius
) {
    return issueService.getNearbyIssues(lat, lng, radius);
 }
 @PostMapping("/{id}/upload")
 public String uploadImage(
         @PathVariable UUID id,
         @RequestParam("file") MultipartFile file
 ) {
     return issueService.uploadImage(id, file);
 }
}
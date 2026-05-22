package com.civicsense.backend.controller;

import com.civicsense.backend.service.TimelineExportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/export")
@RequiredArgsConstructor
public class AdminAuditTimelineExportController {

    private final TimelineExportService timelineExportService;

    @GetMapping(
            value = "/issue-timelines.xlsx",
            produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    public ResponseEntity<byte[]> exportAllIssueTimelinesXlsx() {
        byte[] xlsx = timelineExportService.exportAdminAllIssueTimelinesXlsx();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        );
        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename("civicsense-admin-all-issue-timelines.xlsx")
                        .build()
        );

        return ResponseEntity.ok().headers(headers).body(xlsx);
    }
}

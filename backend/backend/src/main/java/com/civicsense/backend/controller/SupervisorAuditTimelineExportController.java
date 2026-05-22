package com.civicsense.backend.controller;

import com.civicsense.backend.service.TimelineExportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/export/supervisor")
@RequiredArgsConstructor
public class SupervisorAuditTimelineExportController {

    private final TimelineExportService timelineExportService;

    @GetMapping(
            value = "/issue-timelines.xlsx",
            produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    public ResponseEntity<byte[]> exportDepartmentIssueTimelinesXlsx() {
        byte[] xlsx = timelineExportService.exportSupervisorDepartmentIssueTimelinesXlsx();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        );
        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename("civicsense-supervisor-department-issue-timelines.xlsx")
                        .build()
        );

        return ResponseEntity.ok().headers(headers).body(xlsx);
    }
}

package com.civicsense.backend.controller;

import com.civicsense.backend.entity.IssueCategory;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.SeverityLevel;
import com.civicsense.backend.service.CsvExportService;
import com.civicsense.backend.service.XlsxExportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/admin/export")
@RequiredArgsConstructor
public class AdminExportController {

    private final CsvExportService csvExportService;
    private final XlsxExportService xlsxExportService;

    @GetMapping(value = "/issues", produces = "text/csv")
    public ResponseEntity<byte[]> exportIssuesCsv(
            @RequestParam(required = false) IssueCategory category,
            @RequestParam(required = false) SeverityLevel severity,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(required = false) Boolean slaBreached,
            @RequestParam(required = false) Boolean escalated
    ) {
        String csv = csvExportService.exportAdminIssues(
                category,
                severity,
                status,
                slaBreached,
                escalated
        );

        return csvResponse(
                csv,
                "civicsense-admin-issues.csv"
        );
    }

    @GetMapping(value = "/issues.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportIssuesXlsx(
            @RequestParam(required = false) IssueCategory category,
            @RequestParam(required = false) SeverityLevel severity,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(required = false) Boolean slaBreached,
            @RequestParam(required = false) Boolean escalated
    ) {
        byte[] xlsx = xlsxExportService.exportAdminIssues(
                category,
                severity,
                status,
                slaBreached,
                escalated
        );

        return xlsxResponse(
                xlsx,
                "civicsense-admin-issues.xlsx"
        );
    }

    private ResponseEntity<byte[]> csvResponse(String csv, String filename) {
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                new MediaType("text", "csv", StandardCharsets.UTF_8)
        );
        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename(filename)
                        .build()
        );

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(bytes);
    }

    private ResponseEntity<byte[]> xlsxResponse(byte[] xlsx, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        );
        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename(filename)
                        .build()
        );

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(xlsx);
    }
}

package com.civicsense.backend.controller;

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
@RequestMapping("/api/export/supervisor")
@RequiredArgsConstructor
public class SupervisorExportController {

    private final CsvExportService csvExportService;
    private final XlsxExportService xlsxExportService;

    @GetMapping(value = "/tasks", produces = "text/csv")
    public ResponseEntity<byte[]> exportTasksCsv() {
        return csvResponse(
                csvExportService.exportSupervisorTasks(),
                "civicsense-supervisor-tasks.csv"
        );
    }

    @GetMapping(value = "/tasks.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportTasksXlsx() {
        return xlsxResponse(
                xlsxExportService.exportSupervisorTasks(),
                "civicsense-supervisor-tasks.xlsx"
        );
    }

    @GetMapping(value = "/sla-queue", produces = "text/csv")
    public ResponseEntity<byte[]> exportSlaQueueCsv() {
        return csvResponse(
                csvExportService.exportSupervisorSlaQueue(),
                "civicsense-supervisor-sla-queue.csv"
        );
    }

    @GetMapping(value = "/sla-queue.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportSlaQueueXlsx() {
        return xlsxResponse(
                xlsxExportService.exportSupervisorSlaQueue(),
                "civicsense-supervisor-sla-queue.xlsx"
        );
    }

    @GetMapping(value = "/worker-workload", produces = "text/csv")
    public ResponseEntity<byte[]> exportWorkerWorkloadCsv() {
        return csvResponse(
                csvExportService.exportSupervisorWorkerWorkload(),
                "civicsense-supervisor-worker-workload.csv"
        );
    }

    @GetMapping(value = "/worker-workload.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportWorkerWorkloadXlsx() {
        return xlsxResponse(
                xlsxExportService.exportSupervisorWorkerWorkload(),
                "civicsense-supervisor-worker-workload.xlsx"
        );
    }

    @GetMapping(value = "/department-workload", produces = "text/csv")
    public ResponseEntity<byte[]> exportDepartmentWorkloadCsv() {
        return csvResponse(
                csvExportService.exportSupervisorDepartmentWorkload(),
                "civicsense-supervisor-department-workload.csv"
        );
    }

    @GetMapping(value = "/department-workload.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportDepartmentWorkloadXlsx() {
        return xlsxResponse(
                xlsxExportService.exportSupervisorDepartmentWorkload(),
                "civicsense-supervisor-department-workload.xlsx"
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

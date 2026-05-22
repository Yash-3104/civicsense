package com.civicsense.backend.service;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueActivity;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.entity.WorkerDepartment;
import com.civicsense.backend.repository.IssueActivityRepository;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.WorkerDepartmentRepository;
import com.civicsense.backend.security.CustomUserDetails;

import lombok.RequiredArgsConstructor;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TimelineExportService {

    private final IssueRepository issueRepository;
    private final IssueActivityRepository issueActivityRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;

    @Transactional(readOnly = true)
    public byte[] exportIssueTimelineCsv(UUID issueId) {
        Issue issue = getIssue(issueId);
        List<IssueActivity> activities =
                issueActivityRepository.findByIssueIdOrderByCreatedAtAsc(issueId);

        CsvBuilder csv = new CsvBuilder();

        csv.row("Issue Summary");
        csv.row("Issue ID", safe(issue.getId()));
        csv.row("Title", safe(issue.getTitle()));
        csv.row("Category", safeEnum(issue.getCategory()));
        csv.row("Status", safeEnum(issue.getStatus()));
        csv.row("Severity", safeEnum(issue.getSeverity()));
        csv.row("Address", safe(issue.getAddress()));
        csv.row("Assigned Department", safeEnum(issue.getAssignedDepartment()));
        csv.row("Assigned Worker", safeUserName(issue.getAssignedTo()));
        csv.row("SLA Deadline", safe(issue.getSlaDeadline()));
        csv.row("SLA Breached", String.valueOf(Boolean.TRUE.equals(issue.getSlaBreached())));
        csv.row("Escalation Reason", safeEnum(issue.getEscalationReason()));
        csv.row("Resolved At", safe(issue.getResolvedAt()));
        csv.row("Rejected At", safe(issue.getRejectedAt()));
        csv.row();

        writeTimelineCsvRows(csv, issue, activities);

        return csv.build().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportIssueTimelineXlsx(UUID issueId) {
        Issue issue = getIssue(issueId);
        List<IssueActivity> activities =
                issueActivityRepository.findByIssueIdOrderByCreatedAtAsc(issueId);

        return buildTimelineWorkbook(
                "Issue Summary",
                "Issue Timeline",
                List.of(issue),
                activities
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportAdminAllIssueTimelinesXlsx() {
        User currentUser = getCurrentUser();
        validateAdminAuditExportAccess(currentUser);

        List<Issue> issues = issueRepository.findAll()
                .stream()
                .sorted(compareByUpdatedAtDesc())
                .toList();

        List<IssueActivity> activities = issues.stream()
                .flatMap(issue -> issueActivityRepository
                        .findByIssueIdOrderByCreatedAtAsc(issue.getId())
                        .stream())
                .toList();

        return buildTimelineWorkbook(
                "All Issues Summary",
                "All Timeline Events",
                issues,
                activities
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportSupervisorDepartmentIssueTimelinesXlsx() {
        User currentUser = getCurrentUser();
        validateSupervisorAuditExportAccess(currentUser);

        List<Issue> issues = getSupervisorScopedIssues(currentUser)
                .stream()
                .sorted(compareByUpdatedAtDesc())
                .toList();

        List<IssueActivity> activities = issues.stream()
                .flatMap(issue -> issueActivityRepository
                        .findByIssueIdOrderByCreatedAtAsc(issue.getId())
                        .stream())
                .toList();

        return buildTimelineWorkbook(
                "Department Issues",
                "Department Timeline Events",
                issues,
                activities
        );
    }

    private byte[] buildTimelineWorkbook(
            String summarySheetName,
            String timelineSheetName,
            List<Issue> issues,
            List<IssueActivity> activities
    ) {
        try (
                Workbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream()
        ) {
            CellStyle titleStyle = createTitleStyle(workbook);
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle bodyStyle = createBodyStyle(workbook);
            CellStyle mutedStyle = createMutedStyle(workbook);

            Sheet summarySheet = workbook.createSheet(safeSheetName(summarySheetName));
            writeIssuesSummarySheet(summarySheet, issues, titleStyle, headerStyle, bodyStyle, mutedStyle);

            Sheet timelineSheet = workbook.createSheet(safeSheetName(timelineSheetName));
            writeTimelineSheet(timelineSheet, activities, titleStyle, headerStyle, bodyStyle, mutedStyle);

            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (Exception exception) {
            throw new RuntimeException("Failed to generate issue timeline XLSX export", exception);
        }
    }

    private void writeIssuesSummarySheet(
            Sheet sheet,
            List<Issue> issues,
            CellStyle titleStyle,
            CellStyle headerStyle,
            CellStyle bodyStyle,
            CellStyle mutedStyle
    ) {
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(26);

        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("CivicSense Issue Audit Summary");
        titleCell.setCellStyle(titleStyle);

        List<String> headers = List.of(
                "Issue ID",
                "Title",
                "Description",
                "Category",
                "Status",
                "Severity",
                "Address",
                "Assigned Department",
                "Assigned Worker",
                "Reported By",
                "Created At",
                "Updated At",
                "Assigned At",
                "SLA Deadline",
                "SLA Breached",
                "Escalation Reason",
                "Escalation Level",
                "Escalated At",
                "Resolved At",
                "Rejected At",
                "Rejection Reason"
        );

        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(24);

        for (int index = 0; index < headers.size(); index++) {
            Cell cell = headerRow.createCell(index);
            cell.setCellValue(headers.get(index));
            cell.setCellStyle(headerStyle);
        }

        for (int rowIndex = 0; rowIndex < issues.size(); rowIndex++) {
            Issue issue = issues.get(rowIndex);
            Row row = sheet.createRow(rowIndex + 3);

            List<String> values = List.of(
                    safe(issue.getId()),
                    safe(issue.getTitle()),
                    safe(issue.getDescription()),
                    safeEnum(issue.getCategory()),
                    safeEnum(issue.getStatus()),
                    safeEnum(issue.getSeverity()),
                    safe(issue.getAddress()),
                    safeEnum(issue.getAssignedDepartment()),
                    safeUserName(issue.getAssignedTo()),
                    safeUserName(issue.getReportedBy()),
                    safe(issue.getCreatedAt()),
                    safe(issue.getUpdatedAt()),
                    safe(issue.getAssignedAt()),
                    safe(issue.getSlaDeadline()),
                    String.valueOf(Boolean.TRUE.equals(issue.getSlaBreached())),
                    safeEnum(issue.getEscalationReason()),
                    safe(issue.getEscalationLevel()),
                    safe(issue.getEscalatedAt()),
                    safe(issue.getResolvedAt()),
                    safe(issue.getRejectedAt()),
                    safeEnum(issue.getRejectionReason())
            );

            for (int columnIndex = 0; columnIndex < values.size(); columnIndex++) {
                Cell cell = row.createCell(columnIndex);
                String value = values.get(columnIndex);

                cell.setCellValue(value);
                cell.setCellStyle(value == null || value.isBlank() ? mutedStyle : bodyStyle);
            }
        }

        if (!headers.isEmpty()) {
            sheet.setAutoFilter(
                    new CellRangeAddress(2, Math.max(issues.size() + 2, 3), 0, headers.size() - 1)
            );
        }

        sheet.createFreezePane(0, 3);
        autosize(sheet, headers.size());
    }

    private void writeTimelineSheet(
            Sheet sheet,
            List<IssueActivity> activities,
            CellStyle titleStyle,
            CellStyle headerStyle,
            CellStyle bodyStyle,
            CellStyle mutedStyle
    ) {
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(26);

        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("CivicSense Issue Timeline Events");
        titleCell.setCellStyle(titleStyle);

        List<String> headers = List.of(
                "Event ID",
                "Issue ID",
                "Issue Title",
                "Current Status",
                "Activity Type",
                "Message",
                "Actor Name",
                "Actor Role",
                "Metadata",
                "Created At"
        );

        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(24);

        for (int index = 0; index < headers.size(); index++) {
            Cell cell = headerRow.createCell(index);
            cell.setCellValue(headers.get(index));
            cell.setCellStyle(headerStyle);
        }

        for (int rowIndex = 0; rowIndex < activities.size(); rowIndex++) {
            IssueActivity activity = activities.get(rowIndex);
            Issue issue = activity.getIssue();
            Row row = sheet.createRow(rowIndex + 3);

            List<String> values = List.of(
                    safe(activity.getId()),
                    issue == null ? "" : safe(issue.getId()),
                    issue == null ? "" : safe(issue.getTitle()),
                    issue == null ? "" : safeEnum(issue.getStatus()),
                    safeEnum(activity.getType()),
                    safe(activity.getMessage()),
                    safe(activity.getActorName()),
                    safe(activity.getActorRole()),
                    safe(activity.getMetadata()),
                    safe(activity.getCreatedAt())
            );

            for (int columnIndex = 0; columnIndex < values.size(); columnIndex++) {
                Cell cell = row.createCell(columnIndex);
                String value = values.get(columnIndex);

                cell.setCellValue(value);
                cell.setCellStyle(value == null || value.isBlank() ? mutedStyle : bodyStyle);
            }
        }

        if (!headers.isEmpty()) {
            sheet.setAutoFilter(
                    new CellRangeAddress(2, Math.max(activities.size() + 2, 3), 0, headers.size() - 1)
            );
        }

        sheet.createFreezePane(0, 3);
        autosize(sheet, headers.size());
    }

    private void writeTimelineCsvRows(
            CsvBuilder csv,
            Issue issue,
            List<IssueActivity> activities
    ) {
        csv.row(
                "Event ID",
                "Issue ID",
                "Issue Title",
                "Current Status",
                "Activity Type",
                "Message",
                "Actor Name",
                "Actor Role",
                "Metadata",
                "Created At"
        );

        activities.forEach(activity -> csv.row(
                safe(activity.getId()),
                safe(issue.getId()),
                safe(issue.getTitle()),
                safeEnum(issue.getStatus()),
                safeEnum(activity.getType()),
                safe(activity.getMessage()),
                safe(activity.getActorName()),
                safe(activity.getActorRole()),
                safe(activity.getMetadata()),
                safe(activity.getCreatedAt())
        ));
    }

    private Issue getIssue(UUID issueId) {
        return issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));
    }

    private List<Issue> getSupervisorScopedIssues(User currentUser) {
        List<Issue> allIssues = issueRepository.findAll();

        if (currentUser.getRole() == UserRole.ADMIN) {
            return allIssues;
        }

        List<Department> departments = resolveSupervisorDepartments(currentUser);

        if (departments.isEmpty()) {
            return List.of();
        }

        return allIssues.stream()
                .filter(issue -> issue.getAssignedDepartment() != null)
                .filter(issue -> departments.contains(issue.getAssignedDepartment()))
                .toList();
    }

    private List<Department> resolveSupervisorDepartments(User currentUser) {
        if (currentUser == null) {
            return List.of();
        }

        if (currentUser.getRole() == UserRole.ADMIN) {
            return List.of(Department.values());
        }

        return workerDepartmentRepository.findByWorkerId(currentUser.getId())
                .stream()
                .map(WorkerDepartment::getDepartment)
                .filter(Objects::nonNull)
                .distinct()
                .sorted(Comparator.comparing(Enum::name))
                .toList();
    }

    private void validateAdminAuditExportAccess(User currentUser) {
        if (currentUser == null || currentUser.getRole() == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only admin can export all issue timelines");
        }
    }

    private void validateSupervisorAuditExportAccess(User currentUser) {
        if (currentUser == null || currentUser.getRole() == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        if (
                currentUser.getRole() != UserRole.ADMIN &&
                        currentUser.getRole() != UserRole.SUPERVISOR &&
                        currentUser.getRole() != UserRole.OFFICER
        ) {
            throw new RuntimeException("Only supervisor, officer, or admin can export department timelines");
        }
    }

    private Comparator<Issue> compareByUpdatedAtDesc() {
        return (first, second) -> {
            String firstDate = safe(first.getUpdatedAt() == null ? first.getCreatedAt() : first.getUpdatedAt());
            String secondDate = safe(second.getUpdatedAt() == null ? second.getCreatedAt() : second.getUpdatedAt());

            return secondDate.compareTo(firstDate);
        };
    }

    private CellStyle createTitleStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);

        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorder(style);

        return style;
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setBold(true);

        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorder(style);

        return style;
    }

    private CellStyle createBodyStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setWrapText(true);
        style.setVerticalAlignment(VerticalAlignment.TOP);
        applyBorder(style);

        return style;
    }

    private CellStyle createMutedStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setColor(IndexedColors.GREY_50_PERCENT.getIndex());

        CellStyle style = createBodyStyle(workbook);
        style.setFont(font);

        return style;
    }

    private void applyBorder(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
    }

    private void autosize(Sheet sheet, int columns) {
        for (int index = 0; index < columns; index++) {
            sheet.autoSizeColumn(index);

            int width = sheet.getColumnWidth(index);
            sheet.setColumnWidth(index, Math.min(Math.max(width + 900, 3500), 18000));
        }
    }

    private String safeSheetName(String value) {
        String safeName = WorkbookUtil.createSafeSheetName(
                value == null || value.isBlank() ? "Export" : value
        );

        return safeName.substring(0, Math.min(31, safeName.length()));
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || authentication.getPrincipal() == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof CustomUserDetails customUserDetails) {
            return customUserDetails.getUser();
        }

        throw new RuntimeException("Invalid authenticated user");
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safeEnum(Enum<?> value) {
        return value == null ? "" : value.name();
    }

    private String safeUserName(User user) {
        if (user == null) {
            return "";
        }

        if (user.getName() != null && !user.getName().isBlank()) {
            return user.getName();
        }

        return user.getEmail() == null ? "" : user.getEmail();
    }

    private static class CsvBuilder {

        private final StringBuilder builder = new StringBuilder();

        void row(String... values) {
            for (int index = 0; index < values.length; index++) {
                if (index > 0) {
                    builder.append(',');
                }

                builder.append(escape(values[index]));
            }

            builder.append('\n');
        }

        String build() {
            return builder.toString();
        }

        private String escape(String value) {
            if (value == null) {
                return "";
            }

            String normalized = value
                    .replace("\r\n", "\n")
                    .replace("\r", "\n");

            boolean mustQuote =
                    normalized.contains(",") ||
                            normalized.contains("\n") ||
                            normalized.contains("\"");

            String escaped = normalized.replace("\"", "\"\"");

            if (mustQuote) {
                return "\"" + escaped + "\"";
            }

            return escaped;
        }
    }
}

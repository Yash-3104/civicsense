package com.civicsense.backend.service;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueCategory;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.SeverityLevel;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.entity.WorkerDepartment;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.UserRepository;
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
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class XlsxExportService {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;

    @Transactional(readOnly = true)
    public byte[] exportAdminIssues(
            IssueCategory category,
            SeverityLevel severity,
            IssueStatus status,
            Boolean slaBreached,
            Boolean escalated
    ) {
        validateAdminExportAccess(getCurrentUser());

        List<Issue> issues = issueRepository.findAll()
                .stream()
                .filter(issue -> category == null || issue.getCategory() == category)
                .filter(issue -> severity == null || issue.getSeverity() == severity)
                .filter(issue -> status == null || issue.getStatus() == status)
                .filter(issue -> slaBreached == null || isSlaBreached(issue) == slaBreached)
                .filter(issue -> escalated == null || isEscalated(issue) == escalated)
                .sorted(compareByUpdatedAtDesc())
                .toList();

        return buildWorkbook(
                "Admin Issues",
                List.of(
                        "Issue ID",
                        "Title",
                        "Category",
                        "Status",
                        "Severity",
                        "Address",
                        "Department",
                        "Assigned Worker",
                        "Assigned Worker Email",
                        "Created At",
                        "Updated At",
                        "Assigned At",
                        "SLA Deadline",
                        "SLA Breached",
                        "Escalated",
                        "Escalation Level",
                        "Escalation Reason",
                        "Rejection Reason",
                        "Rejected At",
                        "Resolved At"
                ),
                issues.stream()
                        .map(issue -> List.of(
                                safe(issue.getId()),
                                safe(issue.getTitle()),
                                safeEnum(issue.getCategory()),
                                safeEnum(issue.getStatus()),
                                safeEnum(issue.getSeverity()),
                                safe(issue.getAddress()),
                                safeEnum(issue.getAssignedDepartment()),
                                safeUserName(issue.getAssignedTo()),
                                safeUserEmail(issue.getAssignedTo()),
                                safe(issue.getCreatedAt()),
                                safe(issue.getUpdatedAt()),
                                safe(issue.getAssignedAt()),
                                safe(issue.getSlaDeadline()),
                                String.valueOf(isSlaBreached(issue)),
                                String.valueOf(isEscalated(issue)),
                                safe(issue.getEscalationLevel()),
                                safeEnum(issue.getEscalationReason()),
                                safeEnum(issue.getRejectionReason()),
                                safe(issue.getRejectedAt()),
                                safe(issue.getResolvedAt())
                        ))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportSupervisorTasks() {
        User currentUser = getCurrentUser();
        validateSupervisorExportAccess(currentUser);

        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser)
                .stream()
                .filter(this::isActiveOperationalIssue)
                .sorted(compareIssueRiskThenUpdated())
                .toList();

        return buildWorkbook(
                "Supervisor Tasks",
                List.of(
                        "Issue ID",
                        "Title",
                        "Category",
                        "Status",
                        "Severity",
                        "Address",
                        "Department",
                        "Assigned Worker",
                        "Assigned At",
                        "SLA Deadline",
                        "SLA Breached",
                        "Escalated",
                        "Escalation Level",
                        "Escalation Reason",
                        "Updated At"
                ),
                scopedIssues.stream()
                        .map(issue -> List.of(
                                safe(issue.getId()),
                                safe(issue.getTitle()),
                                safeEnum(issue.getCategory()),
                                safeEnum(issue.getStatus()),
                                safeEnum(issue.getSeverity()),
                                safe(issue.getAddress()),
                                safeEnum(issue.getAssignedDepartment()),
                                safeUserName(issue.getAssignedTo()),
                                safe(issue.getAssignedAt()),
                                safe(issue.getSlaDeadline()),
                                String.valueOf(isSlaBreached(issue)),
                                String.valueOf(isEscalated(issue)),
                                safe(issue.getEscalationLevel()),
                                safeEnum(issue.getEscalationReason()),
                                safe(issue.getUpdatedAt())
                        ))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportSupervisorSlaQueue() {
        User currentUser = getCurrentUser();
        validateSupervisorExportAccess(currentUser);

        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser)
                .stream()
                .filter(this::isActiveOperationalIssue)
                .filter(issue -> isSlaBreached(issue) || isEscalated(issue))
                .sorted(compareIssueRiskThenUpdated())
                .toList();

        return buildWorkbook(
                "SLA Escalation Queue",
                List.of(
                        "Issue ID",
                        "Title",
                        "Category",
                        "Status",
                        "Severity",
                        "Address",
                        "Department",
                        "Assigned Worker",
                        "SLA Deadline",
                        "SLA Breached",
                        "Escalated",
                        "Escalation Level",
                        "Escalation Reason",
                        "Escalated At",
                        "Escalated By",
                        "Updated At"
                ),
                scopedIssues.stream()
                        .map(issue -> List.of(
                                safe(issue.getId()),
                                safe(issue.getTitle()),
                                safeEnum(issue.getCategory()),
                                safeEnum(issue.getStatus()),
                                safeEnum(issue.getSeverity()),
                                safe(issue.getAddress()),
                                safeEnum(issue.getAssignedDepartment()),
                                safeUserName(issue.getAssignedTo()),
                                safe(issue.getSlaDeadline()),
                                String.valueOf(isSlaBreached(issue)),
                                String.valueOf(isEscalated(issue)),
                                safe(issue.getEscalationLevel()),
                                safeEnum(issue.getEscalationReason()),
                                safe(issue.getEscalatedAt()),
                                safeUserName(issue.getEscalatedBy()),
                                safe(issue.getUpdatedAt())
                        ))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportSupervisorWorkerWorkload() {
        User currentUser = getCurrentUser();
        validateSupervisorExportAccess(currentUser);

        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser);
        List<User> staff = getSupervisorScopedStaff(currentUser);

        return buildWorkbook(
                "Worker Workload",
                List.of(
                        "Worker ID",
                        "Worker Name",
                        "Worker Email",
                        "Role",
                        "Departments",
                        "Assigned Count",
                        "In Progress Count",
                        "Pending Closure Count",
                        "Resolved Count",
                        "SLA Breached Count",
                        "Escalated Count",
                        "Total Active Count"
                ),
                staff.stream()
                        .sorted(Comparator.comparing(User::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                        .map(worker -> {
                            List<Issue> workerIssues = scopedIssues.stream()
                                    .filter(issue -> issue.getAssignedTo() != null)
                                    .filter(issue -> issue.getAssignedTo().getId().equals(worker.getId()))
                                    .toList();

                            return List.of(
                                    safe(worker.getId()),
                                    safe(worker.getName()),
                                    safe(worker.getEmail()),
                                    safeEnum(worker.getRole()),
                                    String.join(" | ", getWorkerDepartments(worker.getId())),
                                    String.valueOf(countByStatus(workerIssues, IssueStatus.ASSIGNED)),
                                    String.valueOf(countByStatus(workerIssues, IssueStatus.IN_PROGRESS)),
                                    String.valueOf(countByStatus(workerIssues, IssueStatus.PENDING_CLOSURE)),
                                    String.valueOf(countByStatus(workerIssues, IssueStatus.RESOLVED)),
                                    String.valueOf(workerIssues.stream().filter(this::isSlaBreached).count()),
                                    String.valueOf(workerIssues.stream().filter(this::isEscalated).count()),
                                    String.valueOf(workerIssues.stream().filter(this::isActiveOperationalIssue).count())
                            );
                        })
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportSupervisorDepartmentWorkload() {
        User currentUser = getCurrentUser();
        validateSupervisorExportAccess(currentUser);

        List<Issue> scopedIssues = getSupervisorScopedIssues(currentUser);
        List<Department> departments = resolveSupervisorDepartments(currentUser);

        return buildWorkbook(
                "Department Workload",
                List.of(
                        "Department",
                        "Assigned Count",
                        "In Progress Count",
                        "Pending Closure Count",
                        "Resolved Count",
                        "SLA Breached Count",
                        "Escalated Count",
                        "Total Active Count"
                ),
                departments.stream()
                        .sorted(Comparator.comparing(Enum::name))
                        .map(department -> {
                            List<Issue> departmentIssues = scopedIssues.stream()
                                    .filter(issue -> issue.getAssignedDepartment() == department)
                                    .toList();

                            return List.of(
                                    safeEnum(department),
                                    String.valueOf(countByStatus(departmentIssues, IssueStatus.ASSIGNED)),
                                    String.valueOf(countByStatus(departmentIssues, IssueStatus.IN_PROGRESS)),
                                    String.valueOf(countByStatus(departmentIssues, IssueStatus.PENDING_CLOSURE)),
                                    String.valueOf(countByStatus(departmentIssues, IssueStatus.RESOLVED)),
                                    String.valueOf(departmentIssues.stream().filter(this::isSlaBreached).count()),
                                    String.valueOf(departmentIssues.stream().filter(this::isEscalated).count()),
                                    String.valueOf(departmentIssues.stream().filter(this::isActiveOperationalIssue).count())
                            );
                        })
                        .toList()
        );
    }

    private byte[] buildWorkbook(
            String sheetName,
            List<String> headers,
            List<List<String>> rows
    ) {
        try (
                Workbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream()
        ) {
            Sheet sheet = workbook.createSheet(safeSheetName(sheetName));
            sheet.createFreezePane(0, 1);

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle bodyStyle = createBodyStyle(workbook);
            CellStyle warningStyle = createWarningStyle(workbook);
            CellStyle successStyle = createSuccessStyle(workbook);

            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(24);

            for (int index = 0; index < headers.size(); index++) {
                Cell cell = headerRow.createCell(index);
                cell.setCellValue(headers.get(index));
                cell.setCellStyle(headerStyle);
            }

            for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                Row row = sheet.createRow(rowIndex + 1);
                List<String> values = rows.get(rowIndex);

                for (int columnIndex = 0; columnIndex < headers.size(); columnIndex++) {
                    String value = columnIndex < values.size() ? values.get(columnIndex) : "";

                    Cell cell = row.createCell(columnIndex);
                    cell.setCellValue(value);

                    if ("true".equalsIgnoreCase(value)) {
                        cell.setCellStyle(warningStyle);
                    } else if ("false".equalsIgnoreCase(value)) {
                        cell.setCellStyle(successStyle);
                    } else {
                        cell.setCellStyle(bodyStyle);
                    }
                }
            }

            if (!headers.isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(0, Math.max(rows.size(), 1), 0, headers.size() - 1));
            }

            for (int index = 0; index < headers.size(); index++) {
                sheet.autoSizeColumn(index);
                int width = sheet.getColumnWidth(index);
                sheet.setColumnWidth(index, Math.min(Math.max(width + 900, 3500), 15000));
            }

            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (Exception exception) {
            throw new RuntimeException("Failed to generate XLSX export", exception);
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());

        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
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

    private CellStyle createWarningStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setColor(IndexedColors.DARK_RED.getIndex());

        CellStyle style = createBodyStyle(workbook);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.ROSE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        return style;
    }

    private CellStyle createSuccessStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setColor(IndexedColors.DARK_GREEN.getIndex());

        CellStyle style = createBodyStyle(workbook);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);

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

    private String safeSheetName(String value) {
        String sheetName = value == null || value.isBlank() ? "Export" : value;
        return WorkbookUtil.createSafeSheetName(sheetName).substring(0, Math.min(31, WorkbookUtil.createSafeSheetName(sheetName).length()));
    }

    private void validateAdminExportAccess(User currentUser) {
        if (currentUser == null || currentUser.getRole() == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        if (
                currentUser.getRole() != UserRole.ADMIN &&
                        currentUser.getRole() != UserRole.OFFICER &&
                        currentUser.getRole() != UserRole.SUPERVISOR
        ) {
            throw new RuntimeException("Only admin, officer, or supervisor can export issue data");
        }
    }

    private void validateSupervisorExportAccess(User currentUser) {
        if (currentUser == null || currentUser.getRole() == null) {
            throw new RuntimeException("Authenticated user not found");
        }
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

    private List<User> getSupervisorScopedStaff(User currentUser) {
        List<User> staff = userRepository.findByRoleIn(
                List.of(UserRole.WORKER, UserRole.OFFICER, UserRole.SUPERVISOR)
        );

        if (currentUser.getRole() == UserRole.ADMIN) {
            return staff;
        }

        List<Department> departments = resolveSupervisorDepartments(currentUser);

        if (departments.isEmpty()) {
            return List.of();
        }

        Set<UUID> staffIds = departments.stream()
                .flatMap(department -> workerDepartmentRepository.findByDepartment(department).stream())
                .map(WorkerDepartment::getWorker)
                .filter(Objects::nonNull)
                .map(User::getId)
                .collect(Collectors.toSet());

        return staff.stream()
                .filter(user -> staffIds.contains(user.getId()))
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

    private List<String> getWorkerDepartments(UUID workerId) {
        if (workerId == null) {
            return List.of();
        }

        return workerDepartmentRepository.findByWorkerId(workerId)
                .stream()
                .map(WorkerDepartment::getDepartment)
                .filter(Objects::nonNull)
                .map(Enum::name)
                .sorted()
                .toList();
    }

    private boolean isActiveOperationalIssue(Issue issue) {
        if (issue == null || issue.getStatus() == null) {
            return false;
        }

        return issue.getStatus() == IssueStatus.ASSIGNED ||
                issue.getStatus() == IssueStatus.IN_PROGRESS ||
                issue.getStatus() == IssueStatus.PENDING_CLOSURE;
    }

    private boolean isSlaBreached(Issue issue) {
        if (issue == null) {
            return false;
        }

        if (Boolean.TRUE.equals(issue.getSlaBreached())) {
            return true;
        }

        if (!isActiveOperationalIssue(issue)) {
            return false;
        }

        LocalDateTime deadline = issue.getSlaDeadline();

        return deadline != null && LocalDateTime.now().isAfter(deadline);
    }

    private boolean isEscalated(Issue issue) {
        if (issue == null) {
            return false;
        }

        return issue.getEscalationReason() != null ||
                issue.getEscalatedAt() != null ||
                Boolean.TRUE.equals(issue.getSlaBreached());
    }

    private long countByStatus(List<Issue> issues, IssueStatus status) {
        return issues.stream()
                .filter(issue -> issue.getStatus() == status)
                .count();
    }

    private Comparator<Issue> compareByUpdatedAtDesc() {
        return (first, second) -> {
            LocalDateTime firstDate = first.getUpdatedAt() == null
                    ? first.getCreatedAt()
                    : first.getUpdatedAt();

            LocalDateTime secondDate = second.getUpdatedAt() == null
                    ? second.getCreatedAt()
                    : second.getUpdatedAt();

            if (firstDate == null && secondDate == null) {
                return 0;
            }

            if (firstDate == null) {
                return 1;
            }

            if (secondDate == null) {
                return -1;
            }

            return secondDate.compareTo(firstDate);
        };
    }

    private Comparator<Issue> compareIssueRiskThenUpdated() {
        return (first, second) -> {
            boolean firstBreached = isSlaBreached(first);
            boolean secondBreached = isSlaBreached(second);

            if (firstBreached && !secondBreached) {
                return -1;
            }

            if (!firstBreached && secondBreached) {
                return 1;
            }

            LocalDateTime firstDeadline = first.getSlaDeadline();
            LocalDateTime secondDeadline = second.getSlaDeadline();

            if (firstDeadline != null && secondDeadline != null) {
                int deadlineCompare = firstDeadline.compareTo(secondDeadline);

                if (deadlineCompare != 0) {
                    return deadlineCompare;
                }
            }

            if (firstDeadline == null && secondDeadline != null) {
                return 1;
            }

            if (firstDeadline != null) {
                return -1;
            }

            return compareByUpdatedAtDesc().compare(first, second);
        };
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

    private String safeUserEmail(User user) {
        return user == null || user.getEmail() == null ? "" : user.getEmail();
    }
}

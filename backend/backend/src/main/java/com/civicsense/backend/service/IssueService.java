package com.civicsense.backend.service;

import com.civicsense.backend.dto.CreateIssueRequest;
import com.civicsense.backend.dto.EscalateIssueRequest;
import com.civicsense.backend.dto.IssueFilterRequest;
import com.civicsense.backend.dto.IssueImageUploadedEvent;
import com.civicsense.backend.dto.IssueListResponse;
import com.civicsense.backend.dto.IssueMapResponse;
import com.civicsense.backend.dto.IssueActivityResponse;
import com.civicsense.backend.dto.IssueResponse;
import com.civicsense.backend.dto.PaginatedResponse;
import com.civicsense.backend.dto.RealtimeEventType;
import com.civicsense.backend.dto.UpdateIssueStatusRequest;
import com.civicsense.backend.dto.UserSummary;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.EscalationReason;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueMedia;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.IssueActivityType;
import com.civicsense.backend.entity.MediaType;
import com.civicsense.backend.entity.RejectionReason;
import com.civicsense.backend.entity.SeverityLevel;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;

import com.civicsense.backend.repository.IssueMediaRepository;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.UserRepository;

import com.civicsense.backend.security.CustomUserDetails;
import com.civicsense.backend.specification.IssueSpecification;
import com.civicsense.backend.util.DepartmentRouting;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class IssueService {

    private static final double DUPLICATE_WARNING_THRESHOLD = 0.55;

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final IssueMediaRepository issueMediaRepository;
    private final FileStorageService fileStorageService;
    private final IssueEventProducer issueEventProducer;
    private final RealtimeEventService realtimeEventService;
    private final AiServiceClient aiServiceClient;
    private final IssueActivityService issueActivityService;
    private final WorkerService workerService;
    private final NotificationService notificationService;
    private final MediaUrlService mediaUrlService;

    public IssueResponse createIssue(CreateIssueRequest request) {

        CustomUserDetails userDetails =
                (CustomUserDetails) SecurityContextHolder.getContext()
                        .getAuthentication()
                        .getPrincipal();

        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Issue issue = Issue.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .category(request.getCategory())
                .severity(request.getSeverity())
                .status(IssueStatus.REPORTED)
                .priorityScore(0.0)
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .address(request.getAddress())
                .reportedBy(user)
                .slaBreached(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Issue saved = issueRepository.save(issue);

        saved = enrichDuplicateLikelihood(saved);

        issueActivityService.recordActivity(
                saved,
                IssueActivityType.ISSUE_CREATED,
                "Issue reported by " + safeUserName(user),
                user
        );

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.NEW_ISSUE,
                saved
        );

        notificationService.notifyAdminsNewIssue(saved);

        return mapToDetailedResponse(saved);
    }

    @Transactional
    public IssueResponse updateIssueStatus(
            UUID issueId,
            UpdateIssueStatusRequest request
    ) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        IssueStatus previousStatus = issue.getStatus();

        IssueStatus status = request.getStatus();

        if (status == null) {
            throw new RuntimeException("Issue status is required");
        }

        if (status == IssueStatus.IN_PROGRESS) {
            validateWorkerCanStartWork(issue);
        }

        if (status == IssueStatus.RESOLVED) {
            validateAdminCanApproveClosure(issue);
            issue.setSlaBreached(false);
            clearEscalationDetails(issue);
        }

        if (status == IssueStatus.PENDING_CLOSURE) {
            throw new RuntimeException(
                    "Workers must submit closure evidence through the resolve endpoint"
            );
        }

        if (status == IssueStatus.REJECTED) {

            RejectionReason rejectionReason =
                    request.getRejectionReason();

            if (rejectionReason == null) {
                throw new RuntimeException("Rejection reason is required");
            }

            issue.setRejectionReason(rejectionReason);
            issue.setRejectionNotes(request.getRejectionNotes());
            issue.setRejectedAt(LocalDateTime.now());

            issue.setAssignedTo(null);
            issue.setAssignedDepartment(null);
            issue.setAssignedAt(null);
            issue.setSlaDeadline(null);
            issue.setSlaBreached(false);
            clearEscalationDetails(issue);
        }

        if (status != IssueStatus.REJECTED) {
            issue.setRejectionReason(null);
            issue.setRejectionNotes(null);
            issue.setRejectedAt(null);
        }

        issue.setStatus(status);
        issue.setUpdatedAt(LocalDateTime.now());

        Issue savedIssue = issueRepository.save(issue);

        issueActivityService.recordActivity(
                savedIssue,
                resolveActivityTypeForStatus(status),
                buildStatusActivityMessage(previousStatus, status, savedIssue),
                getCurrentUserOrNull()
        );

        realtimeEventService.publishIssueEvent(
                resolveRealtimeEventType(status),
                savedIssue
        );

        notificationService.notifyIssueStatusChanged(savedIssue);

        return mapToDetailedResponse(savedIssue);
    }

    private String resolveRealtimeEventType(IssueStatus status) {

        if (status == IssueStatus.REJECTED) {
            return RealtimeEventType.ISSUE_REJECTED;
        }

        if (status == IssueStatus.PENDING_CLOSURE) {
            return RealtimeEventType.ISSUE_PENDING_CLOSURE;
        }

        if (status == IssueStatus.RESOLVED) {
            return RealtimeEventType.ISSUE_RESOLVED;
        }

        return RealtimeEventType.ISSUE_UPDATED;
    }

    private void validateAdminCanApproveClosure(Issue issue) {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        User currentUser =
                userRepository.findByEmail(userDetails.getUsername())
                        .orElseThrow(() ->
                                new RuntimeException("Authenticated user not found")
                        );

        boolean canApproveClosure =
                currentUser.getRole() == UserRole.ADMIN ||
                        currentUser.getRole() == UserRole.SUPERVISOR ||
                        currentUser.getRole() == UserRole.OFFICER;

        if (!canApproveClosure) {
            throw new RuntimeException(
                    "Only admin, supervisor, or officer can approve closure"
            );
        }

        if (issue.getStatus() != IssueStatus.PENDING_CLOSURE) {
            throw new RuntimeException(
                    "Only pending closure issues can be approved"
            );
        }

        if (
                issue.getResolutionImageUrl() == null ||
                        issue.getResolutionImageUrl().isBlank()
        ) {
            throw new RuntimeException(
                    "Resolution evidence image is required before closure approval"
            );
        }
    }

    private void validateAdminCanDeleteIssue() {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        User currentUser =
                userRepository.findByEmail(userDetails.getUsername())
                        .orElseThrow(() ->
                                new RuntimeException("Authenticated user not found")
                        );

        boolean canDeleteIssue =
                currentUser.getRole() == UserRole.ADMIN ||
                        currentUser.getRole() == UserRole.SUPERVISOR ||
                        currentUser.getRole() == UserRole.OFFICER;

        if (!canDeleteIssue) {
            throw new RuntimeException(
                    "Only admin, supervisor, or officer can delete issues"
            );
        }
    }

    private void validateAdminCanEscalateIssue(Issue issue) {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        User currentUser =
                userRepository.findByEmail(userDetails.getUsername())
                        .orElseThrow(() ->
                                new RuntimeException("Authenticated user not found")
                        );

        boolean canEscalateIssue =
                currentUser.getRole() == UserRole.ADMIN ||
                        currentUser.getRole() == UserRole.SUPERVISOR ||
                        currentUser.getRole() == UserRole.OFFICER;

        if (!canEscalateIssue) {
            throw new RuntimeException(
                    "Only admin, supervisor, or officer can escalate issues"
            );
        }

        if (
                issue.getStatus() == IssueStatus.RESOLVED ||
                        issue.getStatus() == IssueStatus.REJECTED
        ) {
            throw new RuntimeException(
                    "Resolved or rejected issues cannot be escalated"
            );
        }

        if (
                issue.getStatus() != IssueStatus.ASSIGNED &&
                        issue.getStatus() != IssueStatus.IN_PROGRESS &&
                        issue.getStatus() != IssueStatus.PENDING_CLOSURE
        ) {
            throw new RuntimeException(
                    "Only assigned, in-progress, or pending-closure issues can be escalated"
            );
        }

        if (issue.getAssignedTo() == null) {
            throw new RuntimeException(
                    "Only assigned issues can be escalated"
            );
        }
    }

    private boolean isSlaActive(Issue issue) {

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

        if (!isSlaActive(issue)) {
            return false;
        }

        LocalDateTime deadline = issue.getSlaDeadline();

        return deadline != null && LocalDateTime.now().isAfter(deadline);
    }

    private void validateWorkerCanStartWork(Issue issue) {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        User currentUser =
                userRepository.findByEmail(userDetails.getUsername())
                        .orElseThrow(() ->
                                new RuntimeException("Authenticated user not found")
                        );

        boolean isAdminOrSupervisor =
                currentUser.getRole() == UserRole.ADMIN ||
                        currentUser.getRole() == UserRole.SUPERVISOR ||
                        currentUser.getRole() == UserRole.OFFICER;

        if (isAdminOrSupervisor) {
            return;
        }

        if (currentUser.getRole() != UserRole.WORKER) {
            throw new RuntimeException("Only assigned workers can start work");
        }

        if (issue.getAssignedTo() == null) {
            throw new RuntimeException("Issue is not assigned to any worker");
        }

        if (!issue.getAssignedTo().getId().equals(currentUser.getId())) {
            throw new RuntimeException("This issue is assigned to another worker");
        }

        if (issue.getStatus() != IssueStatus.ASSIGNED) {
            throw new RuntimeException("Only assigned issues can be started");
        }
    }

    @Transactional
    public IssueResponse assignIssue(
            UUID issueId,
            UUID workerId,
            Department department
    ) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));

        if (
                worker.getRole() != UserRole.WORKER &&
                        worker.getRole() != UserRole.OFFICER &&
                        worker.getRole() != UserRole.SUPERVISOR
        ) {
            throw new RuntimeException(
                    "Selected user is not eligible for assignment"
            );
        }

        if (department == null) {
            throw new RuntimeException(
                    "Department is required for assignment"
            );
        }

        if (
                !DepartmentRouting
                        .getDepartmentsForCategory(issue.getCategory())
                        .contains(department)
        ) {
            throw new RuntimeException(
                    "Department is not valid for this issue category"
            );
        }

        if (!workerService.workerBelongsToDepartment(worker.getId(), department)) {
            throw new RuntimeException(
                    "Selected worker is not mapped to the selected department"
            );
        }

        issue.setAssignedTo(worker);
        issue.setAssignedDepartment(department);
        issue.setAssignedAt(LocalDateTime.now());
        issue.setSlaDeadline(calculateSlaDeadline(issue));
        issue.setSlaBreached(false);
        clearEscalationDetails(issue);
        issue.setStatus(IssueStatus.ASSIGNED);
        issue.setUpdatedAt(LocalDateTime.now());

        issue.setRejectionReason(null);
        issue.setRejectionNotes(null);
        issue.setRejectedAt(null);

        Issue savedIssue = issueRepository.save(issue);

        issueActivityService.recordActivity(
                savedIssue,
                IssueActivityType.ISSUE_ASSIGNED,
                "Issue assigned to " + safeUserName(worker) +
                        " under " + formatDepartmentLabel(department),
                getCurrentUserOrNull()
        );

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.ISSUE_ASSIGNED,
                savedIssue
        );

        notificationService.notifyIssueAssigned(savedIssue, worker);

        return mapToDetailedResponse(savedIssue);
    }

    @Transactional
    public IssueResponse resolveIssue(
            UUID issueId,
            String resolutionNotes,
            MultipartFile image
    ) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateWorkerCanResolveIssue(issue);

        issue.setStatus(IssueStatus.PENDING_CLOSURE);
        issue.setResolutionNotes(resolutionNotes);
        issue.setResolvedAt(LocalDateTime.now());
        issue.setSlaBreached(isSlaBreached(issue));

        issue.setRejectionReason(null);
        issue.setRejectionNotes(null);
        issue.setRejectedAt(null);

        if (image != null && !image.isEmpty()) {

            try {

                Path savedPath =
                        fileStorageService.storeFile(image);

                String imageUrl =
                        buildImageUrl(
                                savedPath.getFileName().toString()
                        );

                issue.setResolutionImageUrl(imageUrl);

            } catch (Exception e) {

                log.error("Resolution image upload failed for issue: {}", issue.getId(), e);

                throw new RuntimeException(
                        "Resolution image upload failed"
                );
            }
        }

        issue.setUpdatedAt(LocalDateTime.now());

        Issue savedIssue = issueRepository.save(issue);

        issueActivityService.recordActivity(
                savedIssue,
                IssueActivityType.CLOSURE_SUBMITTED,
                "Resolution evidence submitted for admin review",
                getCurrentUserOrNull()
        );

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.ISSUE_PENDING_CLOSURE,
                savedIssue
        );

        notificationService.notifyClosureSubmitted(savedIssue);

        return mapToDetailedResponse(savedIssue);
    }

    private void validateWorkerCanResolveIssue(Issue issue) {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        User currentUser =
                userRepository.findByEmail(userDetails.getUsername())
                        .orElseThrow(() ->
                                new RuntimeException("Authenticated user not found")
                        );

        boolean isAdminOrSupervisor =
                currentUser.getRole() == UserRole.ADMIN ||
                        currentUser.getRole() == UserRole.SUPERVISOR ||
                        currentUser.getRole() == UserRole.OFFICER;

        if (isAdminOrSupervisor) {
            return;
        }

        if (currentUser.getRole() != UserRole.WORKER) {
            throw new RuntimeException("Only assigned workers can resolve work");
        }

        if (issue.getAssignedTo() == null) {
            throw new RuntimeException("Issue is not assigned to any worker");
        }

        if (!issue.getAssignedTo().getId().equals(currentUser.getId())) {
            throw new RuntimeException("This issue is assigned to another worker");
        }

        if (
                issue.getStatus() != IssueStatus.ASSIGNED &&
                        issue.getStatus() != IssueStatus.IN_PROGRESS
        ) {
            throw new RuntimeException(
                    "Only assigned or in-progress issues can be submitted for closure review"
            );
        }
    }

    public Issue recomputeDuplicateLikelihood(UUID issueId) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        Issue updated =
                enrichDuplicateLikelihood(issue);

        issueActivityService.recordActivity(
                updated,
                IssueActivityType.AI_ANALYSIS_COMPLETED,
                "AI duplicate analysis refreshed",
                null
        );

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.ISSUE_UPDATED,
                updated
        );

        return updated;
    }

    @Transactional
    public void deleteIssue(UUID id) {

        validateAdminCanDeleteIssue();

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        issueRepository.delete(issue);

        realtimeEventService.publishIssueDeleted(id);
    }


@Transactional
    public IssueResponse escalateIssue(
            UUID issueId,
            EscalateIssueRequest request
    ) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateAdminCanEscalateIssue(issue);

        User currentUser =
                getCurrentUserOrNull();

        EscalationReason reason =
                request == null || request.getReason() == null
                        ? EscalationReason.SLA_BREACHED
                        : request.getReason();

        String notes =
                request == null
                        ? null
                        : sanitizeOptionalText(request.getNotes());

        String escalationLevel =
                request == null || request.getEscalationLevel() == null ||
                        request.getEscalationLevel().isBlank()
                        ? "LEVEL_1"
                        : request.getEscalationLevel().trim();

        issue.setSlaBreached(true);
        issue.setEscalationReason(reason);
        issue.setEscalationNotes(notes);
        issue.setEscalatedAt(LocalDateTime.now());
        issue.setEscalatedBy(currentUser);
        issue.setEscalationLevel(escalationLevel);
        issue.setUpdatedAt(LocalDateTime.now());

        Issue savedIssue = issueRepository.save(issue);

        issueActivityService.recordActivity(
                savedIssue,
                IssueActivityType.ISSUE_ESCALATED,
                buildEscalationActivityMessage(reason, notes, escalationLevel),
                currentUser
        );

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.ISSUE_ESCALATED,
                savedIssue
        );

        notificationService.notifyIssueEscalated(savedIssue);

        return mapToDetailedResponse(savedIssue);
    }

    public PaginatedResponse<IssueListResponse> getIssues(
            IssueFilterRequest filter,
            int page,
            int size
    ) {

        int safeSize =
                Math.max(1, Math.min(size, 100));

        Pageable pageable =
                PageRequest.of(
                        page,
                        safeSize,
                        Sort.by("createdAt").descending()
                );

        Page<Issue> issues =
                issueRepository.findAll(
                        IssueSpecification.filter(filter),
                        pageable
                );

        List<IssueListResponse> data =
                issues.getContent()
                        .stream()
                        .map(this::mapToListResponse)
                        .toList();

        return PaginatedResponse.<IssueListResponse>builder()
                .data(data)
                .page(issues.getNumber())
                .size(issues.getSize())
                .total(issues.getTotalElements())
                .totalPages(issues.getTotalPages())
                .build();
    }

    public List<IssueListResponse> getMyAssignedIssues() {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        String authenticatedEmail =
                userDetails.getUsername();

        User currentWorker =
                userRepository.findByEmail(authenticatedEmail)
                        .orElseThrow(() ->
                                new RuntimeException("Authenticated worker not found")
                        );

        if (
                currentWorker.getRole() != UserRole.WORKER &&
                        currentWorker.getRole() != UserRole.OFFICER &&
                        currentWorker.getRole() != UserRole.SUPERVISOR
        ) {
            throw new RuntimeException(
                    "Only workers, officers, or supervisors can access worker dashboard"
            );
        }

        return getAssignedIssuesByWorker(
                currentWorker.getId()
        );
    }

    public List<IssueListResponse> getAssignedIssuesByWorker(UUID workerId) {

        if (workerId == null) {
            throw new RuntimeException("Worker ID is required");
        }

        User worker =
                userRepository.findById(workerId)
                        .orElseThrow(() ->
                                new RuntimeException("Worker not found")
                        );

        if (
                worker.getRole() != UserRole.WORKER &&
                        worker.getRole() != UserRole.OFFICER &&
                        worker.getRole() != UserRole.SUPERVISOR
        ) {
            throw new RuntimeException(
                    "Selected user is not eligible for worker dashboard"
            );
        }

        UUID safeWorkerId =
                worker.getId();

        return issueRepository.findAll()
                .stream()
                .filter(issue ->
                        issue.getAssignedTo() != null &&
                                issue.getAssignedTo().getId() != null
                )
                .filter(issue ->
                        issue.getAssignedTo()
                                .getId()
                                .equals(safeWorkerId)
                )
                .filter(issue ->
                        issue.getStatus() == IssueStatus.ASSIGNED ||
                                issue.getStatus() == IssueStatus.IN_PROGRESS ||
                                issue.getStatus() == IssueStatus.PENDING_CLOSURE ||
                                issue.getStatus() == IssueStatus.RESOLVED
                )
                .sorted((first, second) -> {

                    LocalDateTime firstDeadline =
                            first.getSlaDeadline();

                    LocalDateTime secondDeadline =
                            second.getSlaDeadline();

                    if (firstDeadline == null && secondDeadline == null) {

                        LocalDateTime firstUpdated =
                                first.getUpdatedAt();

                        LocalDateTime secondUpdated =
                                second.getUpdatedAt();

                        if (firstUpdated == null && secondUpdated == null) {
                            return 0;
                        }

                        if (firstUpdated == null) {
                            return 1;
                        }

                        if (secondUpdated == null) {
                            return -1;
                        }

                        return secondUpdated.compareTo(firstUpdated);
                    }

                    if (firstDeadline == null) {
                        return 1;
                    }

                    if (secondDeadline == null) {
                        return -1;
                    }

                    return firstDeadline.compareTo(secondDeadline);
                })
                .map(this::mapToListResponse)
                .toList();
    }

    public IssueResponse getIssueById(UUID id) {

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        return mapToDetailedResponse(issue);
    }

    public List<IssueActivityResponse> getIssueTimeline(UUID id) {

        if (!issueRepository.existsById(id)) {
            throw new RuntimeException("Issue not found");
        }

        return issueActivityService.getTimeline(id);
    }

    public List<IssueMapResponse> getNearbyIssues(
            double lat,
            double lng,
            double radius
    ) {

        List<Issue> issues =
                issueRepository.findNearbyIssues(
                        lat,
                        lng,
                        radius
                );

        return issues.stream()
                .map(issue -> IssueMapResponse.builder()
                        .id(issue.getId())
                        .title(issue.getTitle())
                        .category(issue.getCategory().name())
                        .status(issue.getStatus().name())
                        .severity(issue.getSeverity().name())
                        .latitude(issue.getLatitude())
                        .longitude(issue.getLongitude())
                        .address(issue.getAddress())
                        .imageUrl(getPrimaryImageUrl(issue))
                        .aiConfidenceScore(issue.getAiConfidenceScore())
                        .fakeReportLikelihood(issue.getFakeReportLikelihood())
                        .duplicateLikelihood(issue.getDuplicateLikelihood())
                        .possibleDuplicateIssueId(issue.getPossibleDuplicateIssueId())
                        .resolutionImageUrl(issue.getResolutionImageUrl())
                        .resolvedAt(issue.getResolvedAt())
                        .rejectionReason(
                                issue.getRejectionReason() == null
                                        ? null
                                        : issue.getRejectionReason().name()
                        )
                        .rejectedAt(issue.getRejectedAt())
                        .assignedTo(mapUserSummary(issue.getAssignedTo()))
                        .assignedDepartment(formatDepartment(issue.getAssignedDepartment()))
                        .assignedAt(issue.getAssignedAt())
                        .slaDeadline(issue.getSlaDeadline())
                        .slaBreached(isSlaBreached(issue))
                        .escalationReason(
                                issue.getEscalationReason() == null
                                        ? null
                                        : issue.getEscalationReason().name()
                        )
                        .escalationNotes(issue.getEscalationNotes())
                        .escalatedAt(issue.getEscalatedAt())
                        .escalatedBy(mapUserSummary(issue.getEscalatedBy()))
                        .escalationLevel(issue.getEscalationLevel())
                        .build()
                )
                .toList();
    }

    public String uploadImage(
            UUID issueId,
            MultipartFile file
    ) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        Path savedPath =
                fileStorageService.storeFile(file);

        String fileName =
                savedPath.getFileName().toString();

        String fullPath =
                savedPath.toString();

        IssueMedia media =
                IssueMedia.builder()
                        .issue(issue)
                        .mediaUrl(fileName)
                        .mediaType(MediaType.IMAGE)
                        .build();

        issueMediaRepository.save(media);

        issueActivityService.recordActivity(
                issue,
                IssueActivityType.IMAGE_UPLOADED,
                "Issue image uploaded and queued for AI processing",
                getCurrentUserOrNull()
        );

        issueEventProducer.publishImageUploaded(
                IssueImageUploadedEvent.builder()
                        .issueId(issue.getId())
                        .filePath(fullPath)
                        .fileName(fileName)
                        .build()
        );

        return "Image uploaded, AI processing queued";
    }


    private IssueActivityType resolveActivityTypeForStatus(IssueStatus status) {

        if (status == IssueStatus.VERIFIED) {
            return IssueActivityType.ISSUE_VERIFIED;
        }

        if (status == IssueStatus.REJECTED) {
            return IssueActivityType.ISSUE_REJECTED;
        }

        if (status == IssueStatus.IN_PROGRESS) {
            return IssueActivityType.WORK_STARTED;
        }

        if (status == IssueStatus.RESOLVED) {
            return IssueActivityType.CLOSURE_APPROVED;
        }

        return IssueActivityType.STATUS_CHANGED;
    }

    private String buildStatusActivityMessage(
            IssueStatus previousStatus,
            IssueStatus newStatus,
            Issue issue
    ) {

        if (newStatus == IssueStatus.VERIFIED) {
            return "Issue verified by operations team";
        }

        if (newStatus == IssueStatus.REJECTED) {
            String reason =
                    issue.getRejectionReason() == null
                            ? "unspecified reason"
                            : issue.getRejectionReason().name().replace("_", " ");

            return "Issue rejected: " + reason;
        }

        if (newStatus == IssueStatus.IN_PROGRESS) {
            return "Worker started work on this issue";
        }

        if (newStatus == IssueStatus.RESOLVED) {
            return "Closure approved after reviewing resolution evidence";
        }

        return "Status changed from " +
                formatStatusLabel(previousStatus) +
                " to " +
                formatStatusLabel(newStatus);
    }

    private User getCurrentUserOrNull() {

        Object principal =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            return null;
        }

        return userRepository.findByEmail(userDetails.getUsername())
                .orElse(null);
    }

    private String safeUserName(User user) {

        if (user == null) {
            return "System";
        }

        if (user.getName() != null && !user.getName().isBlank()) {
            return user.getName();
        }

        return user.getEmail() == null ? "User" : user.getEmail();
    }

    private String formatDepartmentLabel(Department department) {

        if (department == null) {
            return "Unassigned Department";
        }

        return department.name().replace("_", " ");
    }

    private String formatStatusLabel(IssueStatus status) {

        if (status == null) {
            return "UNKNOWN";
        }

        return status.name().replace("_", " ");
    }


    private String sanitizeOptionalText(String value) {

        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isBlank() ? null : trimmed;
    }

    private void clearEscalationDetails(Issue issue) {

        if (issue == null) {
            return;
        }

        issue.setEscalationReason(null);
        issue.setEscalationNotes(null);
        issue.setEscalatedAt(null);
        issue.setEscalatedBy(null);
        issue.setEscalationLevel(null);
    }

    private String buildEscalationActivityMessage(
            EscalationReason reason,
            String notes,
            String escalationLevel
    ) {

        String reasonLabel =
                reason == null
                        ? "SLA BREACHED"
                        : reason.name().replace("_", " ");

        String level =
                escalationLevel == null || escalationLevel.isBlank()
                        ? "LEVEL_1"
                        : escalationLevel;

        StringBuilder message =
                new StringBuilder()
                        .append("Issue escalated")
                        .append(" · Reason: ")
                        .append(reasonLabel)
                        .append(" · Level: ")
                        .append(level);

        if (notes != null && !notes.isBlank()) {
            message.append(" · Notes: ").append(notes);
        }

        return message.toString();
    }

    private LocalDateTime calculateSlaDeadline(Issue issue) {

        SeverityLevel severity =
                issue.getSeverity();

        if (severity == null) {
            return LocalDateTime.now().plusDays(3);
        }

        return switch (severity) {

            case HIGH ->
                    LocalDateTime.now().plusHours(24);

            case MEDIUM ->
                    LocalDateTime.now().plusDays(3);

            case LOW ->
                    LocalDateTime.now().plusDays(7);

            default ->
                    LocalDateTime.now().plusDays(5);
        };
    }

    private Issue enrichDuplicateLikelihood(Issue sourceIssue) {

        try {
            log.debug("Duplicate check started for issue: {}", sourceIssue.getId());

            List<Issue> nearbyIssues =
                    issueRepository.findNearbyIssues(
                            sourceIssue.getLatitude(),
                            sourceIssue.getLongitude(),
                            0.5
                    );

            log.debug("Nearby issues found for duplicate check: {}", nearbyIssues.size());

            List<Issue> candidates =
                    nearbyIssues.stream()
                            .filter(issue ->
                                    !issue.getId().equals(sourceIssue.getId())
                            )
                            .filter(issue ->
                                    issue.getCategory() == sourceIssue.getCategory()
                            )
                            .filter(issue ->
                                    issue.getCreatedAt() != null &&
                                            issue.getCreatedAt().isAfter(
                                                    LocalDateTime.now().minusDays(7)
                                            )
                            )
                            .toList();

            log.debug("Duplicate candidates found: {}", candidates.size());

            if (candidates.isEmpty()) {
                sourceIssue.setDuplicateLikelihood(0.0);
                sourceIssue.setPossibleDuplicateIssueId(null);
                return issueRepository.save(sourceIssue);
            }

            String sourceText =
                    buildSemanticDuplicateText(sourceIssue);

            List<String> candidateTexts =
                    candidates.stream()
                            .map(this::buildSemanticDuplicateText)
                            .toList();

            log.debug("Source duplicate text: {}", sourceText);

            List<Double> semanticScores =
                    aiServiceClient.checkDuplicateSimilarity(
                            sourceText,
                            candidateTexts
                    );

            log.debug("Semantic duplicate scores: {}", semanticScores);

            double bestSemanticScore = 0.0;
            Issue bestCandidate = null;

            for (
                    int i = 0;
                    i < semanticScores.size() && i < candidates.size();
                    i++
            ) {

                double score =
                        semanticScores.get(i);

                if (score > bestSemanticScore) {
                    bestSemanticScore = score;
                    bestCandidate = candidates.get(i);
                }
            }

            double duplicateLikelihood = 0.0;

            if (bestCandidate != null) {

                double distanceMeters =
                        calculateDistanceMeters(
                                sourceIssue.getLatitude(),
                                sourceIssue.getLongitude(),
                                bestCandidate.getLatitude(),
                                bestCandidate.getLongitude()
                        );

                double geoScore =
                        calculateGeoScore(distanceMeters);

                double timeScore =
                        calculateTimeScore(
                                bestCandidate.getCreatedAt()
                        );

                duplicateLikelihood =
                        clamp(
                                (bestSemanticScore * 0.5) +
                                        (geoScore * 0.35) +
                                        (timeScore * 0.15)
                        );

                if (duplicateLikelihood >= DUPLICATE_WARNING_THRESHOLD) {
                    sourceIssue.setPossibleDuplicateIssueId(
                            bestCandidate.getId()
                    );
                } else {
                    sourceIssue.setPossibleDuplicateIssueId(null);
                }

                log.debug("Best duplicate candidate: {}", bestCandidate.getId());
                log.debug("Best semantic score: {}", bestSemanticScore);
                log.debug("Geo score: {}", geoScore);
                log.debug("Time score: {}", timeScore);
                log.debug("Final duplicate likelihood: {}", duplicateLikelihood);

            } else {
                sourceIssue.setPossibleDuplicateIssueId(null);
            }

            sourceIssue.setDuplicateLikelihood(
                    round2(duplicateLikelihood)
            );

            return issueRepository.save(sourceIssue);

        } catch (Exception e) {

            log.debug("Duplicate semantic check failed, using fallback: {}", e.getMessage());

            DuplicateFallbackResult fallback =
                    calculateFallbackDuplicateLikelihood(sourceIssue);

            sourceIssue.setDuplicateLikelihood(
                    fallback.score()
            );

            sourceIssue.setPossibleDuplicateIssueId(
                    fallback.score() >= DUPLICATE_WARNING_THRESHOLD
                            ? fallback.possibleDuplicateIssueId()
                            : null
            );

            return issueRepository.save(sourceIssue);
        }
    }

    private DuplicateFallbackResult calculateFallbackDuplicateLikelihood(
            Issue issue
    ) {

        try {
            List<Issue> nearbyIssues =
                    issueRepository.findNearbyIssues(
                            issue.getLatitude(),
                            issue.getLongitude(),
                            0.5
                    );

            double bestScore = 0.0;
            UUID bestIssueId = null;

            for (Issue candidate : nearbyIssues) {

                if (candidate.getId().equals(issue.getId())) {
                    continue;
                }

                double geoScore =
                        calculateGeoScore(
                                calculateDistanceMeters(
                                        issue.getLatitude(),
                                        issue.getLongitude(),
                                        candidate.getLatitude(),
                                        candidate.getLongitude()
                                )
                        );

                double timeScore =
                        candidate.getCreatedAt() == null
                                ? 0.1
                                : calculateTimeScore(
                                candidate.getCreatedAt()
                        );

                double categoryScore =
                        candidate.getCategory() == issue.getCategory()
                                ? 1.0
                                : 0.35;

                double combined =
                        (geoScore * 0.45) +
                                (timeScore * 0.25) +
                                (categoryScore * 0.30);

                if (combined > bestScore) {
                    bestScore = combined;
                    bestIssueId = candidate.getId();
                }
            }

            return new DuplicateFallbackResult(
                    round2(clamp(bestScore)),
                    bestIssueId
            );

        } catch (Exception e) {
            return new DuplicateFallbackResult(
                    0.0,
                    null
            );
        }
    }

    private record DuplicateFallbackResult(
            double score,
            UUID possibleDuplicateIssueId
    ) {}

    private String buildSemanticDuplicateText(Issue issue) {

        StringBuilder builder =
                new StringBuilder();

        appendText(builder, issue.getTitle());
        appendText(builder, issue.getDescription());

        if (issue.getCategory() != null) {
            appendText(
                    builder,
                    issue.getCategory().name()
            );
        }

        appendText(builder, issue.getAiDescription());
        appendText(builder, issue.getAiRawCaption());
        appendText(builder, issue.getAiClipLabel());
        appendText(builder, issue.getAddress());

        return builder.toString().trim();
    }

    private void appendText(
            StringBuilder builder,
            String value
    ) {

        if (value != null && !value.isBlank()) {
            builder.append(value.trim()).append(". ");
        }
    }

    private double calculateGeoScore(double distanceMeters) {

        if (distanceMeters <= 20) {
            return 1.0;
        }

        if (distanceMeters <= 50) {
            return 0.8;
        }

        if (distanceMeters <= 100) {
            return 0.5;
        }

        return 0.1;
    }

    private double calculateTimeScore(LocalDateTime createdAt) {

        if (createdAt == null) {
            return 0.1;
        }

        long hours =
                ChronoUnit.HOURS.between(
                        createdAt,
                        LocalDateTime.now()
                );

        if (hours <= 6) {
            return 1.0;
        }

        if (hours <= 24) {
            return 0.7;
        }

        if (hours <= 72) {
            return 0.4;
        }

        return 0.1;
    }

    private double calculateDistanceMeters(
            Double lat1,
            Double lng1,
            Double lat2,
            Double lng2
    ) {

        if (
                lat1 == null ||
                        lng1 == null ||
                        lat2 == null ||
                        lng2 == null
        ) {
            return Double.MAX_VALUE;
        }

        final double earthRadius =
                6_371_000.0;

        double dLat =
                Math.toRadians(lat2 - lat1);

        double dLng =
                Math.toRadians(lng2 - lng1);

        double a =
                Math.sin(dLat / 2) *
                        Math.sin(dLat / 2) +
                        Math.cos(Math.toRadians(lat1)) *
                                Math.cos(Math.toRadians(lat2)) *
                                Math.sin(dLng / 2) *
                                Math.sin(dLng / 2);

        double c =
                2 *
                        Math.atan2(
                                Math.sqrt(a),
                                Math.sqrt(1 - a)
                        );

        return earthRadius * c;
    }

    private double clamp(double value) {

        return Math.max(
                0.0,
                Math.min(value, 1.0)
        );
    }

    private double round2(double value) {

        return Math.round(value * 100.0) / 100.0;
    }

    private String buildImageUrl(String mediaUrl) {
        return mediaUrlService.resolveUploadUrl(mediaUrl);
    }

    private List<String> getMediaUrls(Issue issue) {

        if (
                issue.getMedia() == null ||
                        issue.getMedia().isEmpty()
        ) {
            return List.of();
        }

        return issue.getMedia()
                .stream()
                .map(media ->
                        buildImageUrl(media.getMediaUrl())
                )
                .toList();
    }

    private String getPrimaryImageUrl(Issue issue) {

        List<String> mediaUrls =
                getMediaUrls(issue);

        if (mediaUrls.isEmpty()) {
            return null;
        }

        return mediaUrls.get(0);
    }

    private String formatDepartment(Department department) {

        if (department == null) {
            return null;
        }

        return department.name();
    }

    private UserSummary mapUserSummary(User user) {

        if (user == null) {
            return null;
        }

        return UserSummary.builder()
                .id(user.getId())
                .name(user.getName())
                .build();
    }

    private IssueListResponse mapToListResponse(Issue issue) {

        return IssueListResponse.builder()
                .id(issue.getId())
                .title(issue.getTitle())
                .category(issue.getCategory().name())
                .status(issue.getStatus().name())
                .severity(issue.getSeverity().name())
                .address(issue.getAddress())
                .createdAt(issue.getCreatedAt())
                .imageUrl(getPrimaryImageUrl(issue))
                .aiConfidenceScore(issue.getAiConfidenceScore())
                .fakeReportLikelihood(issue.getFakeReportLikelihood())
                .duplicateLikelihood(issue.getDuplicateLikelihood())
                .possibleDuplicateIssueId(issue.getPossibleDuplicateIssueId())
                .resolutionImageUrl(issue.getResolutionImageUrl())
                .resolvedAt(issue.getResolvedAt())
                .rejectionReason(
                        issue.getRejectionReason() == null
                                ? null
                                : issue.getRejectionReason().name()
                )
                .rejectedAt(issue.getRejectedAt())
                .assignedTo(mapUserSummary(issue.getAssignedTo()))
                .assignedDepartment(formatDepartment(issue.getAssignedDepartment()))
                .assignedAt(issue.getAssignedAt())
                .slaDeadline(issue.getSlaDeadline())
                .slaBreached(isSlaBreached(issue))
                .escalationReason(
                        issue.getEscalationReason() == null
                                ? null
                                : issue.getEscalationReason().name()
                )
                .escalationNotes(issue.getEscalationNotes())
                .escalatedAt(issue.getEscalatedAt())
                .escalatedBy(mapUserSummary(issue.getEscalatedBy()))
                .escalationLevel(issue.getEscalationLevel())
                .build();
    }

    private IssueResponse mapToDetailedResponse(Issue issue) {

        List<String> mediaUrls =
                getMediaUrls(issue);

        return IssueResponse.builder()
                .id(issue.getId())
                .title(issue.getTitle())
                .description(issue.getDescription())
                .category(issue.getCategory().name())
                .status(issue.getStatus().name())
                .severity(issue.getSeverity().name())
                .priorityScore(issue.getPriorityScore())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .address(issue.getAddress())
                .reportedBy(
                        mapUserSummary(issue.getReportedBy())
                )
                .assignedTo(
                        mapUserSummary(issue.getAssignedTo())
                )
                .assignedDepartment(
                        formatDepartment(issue.getAssignedDepartment())
                )
                .assignedAt(issue.getAssignedAt())
                .slaDeadline(issue.getSlaDeadline())
                .slaBreached(
                        Boolean.TRUE.equals(issue.getSlaBreached())
                )
                .escalationReason(
                        issue.getEscalationReason() == null
                                ? null
                                : issue.getEscalationReason().name()
                )
                .escalationNotes(issue.getEscalationNotes())
                .escalatedAt(issue.getEscalatedAt())
                .escalatedBy(mapUserSummary(issue.getEscalatedBy()))
                .escalationLevel(issue.getEscalationLevel())
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .imageUrl(
                        mediaUrls.isEmpty()
                                ? null
                                : mediaUrls.get(0)
                )
                .mediaUrls(mediaUrls)
                .aiDescription(issue.getAiDescription())
                .aiConfidenceScore(issue.getAiConfidenceScore())
                .fakeReportLikelihood(issue.getFakeReportLikelihood())
                .severityConfidence(issue.getSeverityConfidence())
                .duplicateLikelihood(issue.getDuplicateLikelihood())
                .possibleDuplicateIssueId(issue.getPossibleDuplicateIssueId())
                .aiReasoning(issue.getAiReasoning())
                .resolutionNotes(issue.getResolutionNotes())
                .resolutionImageUrl(issue.getResolutionImageUrl())
                .resolvedAt(issue.getResolvedAt())
                .rejectionReason(
                        issue.getRejectionReason() == null
                                ? null
                                : issue.getRejectionReason().name()
                )
                .rejectionNotes(issue.getRejectionNotes())
                .rejectedAt(issue.getRejectedAt())
                .build();
    }
}

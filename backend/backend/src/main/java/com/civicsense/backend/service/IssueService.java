package com.civicsense.backend.service;

import com.civicsense.backend.dto.*;
import com.civicsense.backend.entity.*;
import com.civicsense.backend.repository.*;
import com.civicsense.backend.security.CustomUserDetails;
import com.civicsense.backend.specification.IssueSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueService {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;

    // 🔥 FILE + MEDIA
    private final FileStorageService fileStorageService;
    private final IssueMediaRepository issueMediaRepository;

    // 🔥 KAFKA PRODUCER
    private final IssueEventProducer issueEventProducer;

    // ================= CREATE ISSUE =================
    public IssueResponse createIssue(CreateIssueRequest request) {

        CustomUserDetails userDetails =
                (CustomUserDetails) SecurityContextHolder.getContext()
                        .getAuthentication().getPrincipal();

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
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Issue saved = issueRepository.save(issue);

        return mapToDetailedResponse(saved);
    }

    // ================= GET ISSUES =================
    public PaginatedResponse<IssueListResponse> getIssues(IssueFilterRequest filter, int page, int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<Issue> issues = issueRepository.findAll(
                IssueSpecification.filter(filter),
                pageable
        );

        List<IssueListResponse> data = issues.getContent().stream()
                .map(issue -> IssueListResponse.builder()
                        .id(issue.getId())
                        .title(issue.getTitle())
                        .category(issue.getCategory().name())
                        .address(issue.getAddress())
                        .severity(issue.getSeverity().name())
                        .build()
                )
                .toList();

        return PaginatedResponse.<IssueListResponse>builder()
                .data(data)
                .page(issues.getNumber())
                .size(issues.getSize())
                .total(issues.getTotalElements())
                .totalPages(issues.getTotalPages())
                .build();
    }

    // ================= GET BY ID =================
    public IssueResponse getIssueById(UUID id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        return mapToDetailedResponse(issue);
    }

    // ================= GEO =================
    public List<IssueMapResponse> getNearbyIssues(double lat, double lng, double radius) {

        List<Issue> issues = issueRepository.findNearbyIssues(lat, lng, radius);

        return issues.stream()
                .map(issue -> IssueMapResponse.builder()
                        .id(issue.getId())
                        .title(issue.getTitle())
                        .category(issue.getCategory().name())
                        .severity(issue.getSeverity().name())
                        .latitude(issue.getLatitude())
                        .longitude(issue.getLongitude())
                        .build()
                )
                .toList();
    }

    // ================= 🔥 IMAGE UPLOAD (KAFKA) =================
    public String uploadImage(UUID issueId, MultipartFile file) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        // 1️⃣ Save file
        String fileName = fileStorageService.storeFile(file);
        String fullPath = "uploads/" + fileName;

        // 2️⃣ Save media
        IssueMedia media = IssueMedia.builder()
                .issue(issue)
                .mediaUrl(fileName)
                .mediaType(MediaType.IMAGE)
                .build();

        issueMediaRepository.save(media);

        // 3️⃣ 🔥 PUBLISH EVENT TO KAFKA
        issueEventProducer.publishImageUploaded(
                IssueImageUploadedEvent.builder()
                        .issueId(issue.getId())
                        .filePath(fullPath)
                        .fileName(fileName)
                        .build()
        );

        // 4️⃣ Return immediately
        return "Image uploaded, AI processing queued";
    }

    // ================= MAPPER =================
    private IssueResponse mapToDetailedResponse(Issue issue) {
        return IssueResponse.builder()
                .id(issue.getId())
                .title(issue.getTitle())
                .description(issue.getDescription())
                .category(issue.getCategory().name())
                .status(issue.getStatus().name())
                .severity(issue.getSeverity().name())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .address(issue.getAddress())
                .reportedBy(
                        UserSummary.builder()
                                .id(issue.getReportedBy().getId())
                                .name(issue.getReportedBy().getName())
                                .build()
                )
                .createdAt(issue.getCreatedAt())
                .build();
    }
}
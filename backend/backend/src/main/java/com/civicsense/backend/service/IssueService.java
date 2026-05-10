package com.civicsense.backend.service;

import com.civicsense.backend.dto.CreateIssueRequest;
import com.civicsense.backend.dto.IssueFilterRequest;
import com.civicsense.backend.dto.IssueImageUploadedEvent;
import com.civicsense.backend.dto.IssueListResponse;
import com.civicsense.backend.dto.IssueMapResponse;
import com.civicsense.backend.dto.IssueResponse;
import com.civicsense.backend.dto.PaginatedResponse;
import com.civicsense.backend.dto.RealtimeEventType;
import com.civicsense.backend.dto.UserSummary;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueMedia;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.MediaType;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.repository.IssueMediaRepository;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.security.CustomUserDetails;
import com.civicsense.backend.specification.IssueSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueService {

    private static final double DUPLICATE_WARNING_THRESHOLD = 0.55;

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final IssueMediaRepository issueMediaRepository;
    private final FileStorageService fileStorageService;
    private final IssueEventProducer issueEventProducer;
    private final RealtimeEventService realtimeEventService;
    private final AiServiceClient aiServiceClient;

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
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Issue saved = issueRepository.save(issue);

        // v1 duplicate check: uses title + user/autofilled description + category + geo/time.
        saved = enrichDuplicateLikelihood(saved);

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.NEW_ISSUE,
                saved
        );

        return mapToDetailedResponse(saved);
    }

    /**
     * Duplicate Detection v2.
     * Called after async image AI processing completes, so it can use:
     * title + description + aiDescription + raw BLIP caption + CLIP label + geo/time.
     */
    public Issue recomputeDuplicateLikelihood(UUID issueId) {

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        Issue updated = enrichDuplicateLikelihood(issue);

        realtimeEventService.publishIssueEvent(
                RealtimeEventType.ISSUE_UPDATED,
                updated
        );

        return updated;
    }

    public void deleteIssue(UUID id) {

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        issueRepository.delete(issue);

        realtimeEventService.publishIssueDeleted(id);
    }

    public PaginatedResponse<IssueListResponse> getIssues(
            IssueFilterRequest filter,
            int page,
            int size
    ) {

        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by("createdAt").descending()
        );

        Page<Issue> issues = issueRepository.findAll(
                IssueSpecification.filter(filter),
                pageable
        );

        List<IssueListResponse> data = issues.getContent()
                .stream()
                .map(issue -> IssueListResponse.builder()
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

    public IssueResponse getIssueById(UUID id) {

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        return mapToDetailedResponse(issue);
    }

    public List<IssueMapResponse> getNearbyIssues(
            double lat,
            double lng,
            double radius
    ) {

        List<Issue> issues = issueRepository.findNearbyIssues(lat, lng, radius);

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

        java.nio.file.Path savedPath = fileStorageService.storeFile(file);

        String fileName = savedPath.getFileName().toString();
        String fullPath = savedPath.toString();

        IssueMedia media = IssueMedia.builder()
                .issue(issue)
                .mediaUrl(fileName)
                .mediaType(MediaType.IMAGE)
                .build();

        issueMediaRepository.save(media);

        issueEventProducer.publishImageUploaded(
                IssueImageUploadedEvent.builder()
                        .issueId(issue.getId())
                        .filePath(fullPath)
                        .fileName(fileName)
                        .build()
        );

        return "Image uploaded, AI processing queued";
    }

    private Issue enrichDuplicateLikelihood(Issue sourceIssue) {

        try {
            System.out.println("DUPLICATE CHECK START: " + sourceIssue.getId());

            List<Issue> nearbyIssues = issueRepository.findNearbyIssues(
                    sourceIssue.getLatitude(),
                    sourceIssue.getLongitude(),
                    0.5
            );

            System.out.println("Nearby issues found: " + nearbyIssues.size());

            List<Issue> candidates = nearbyIssues.stream()
                    .filter(issue -> !issue.getId().equals(sourceIssue.getId()))
                    .filter(issue -> issue.getCategory() == sourceIssue.getCategory())
                    .filter(issue ->
                            issue.getCreatedAt() != null &&
                            issue.getCreatedAt().isAfter(
                                    LocalDateTime.now().minusDays(7)
                            )
                    )
                    .toList();

            System.out.println("Duplicate candidates found: " + candidates.size());

            if (candidates.isEmpty()) {
                sourceIssue.setDuplicateLikelihood(0.0);
                sourceIssue.setPossibleDuplicateIssueId(null);
                return issueRepository.save(sourceIssue);
            }

            String sourceText = buildSemanticDuplicateText(sourceIssue);

            List<String> candidateTexts = candidates.stream()
                    .map(this::buildSemanticDuplicateText)
                    .toList();

            System.out.println("Source duplicate text: " + sourceText);

            List<Double> semanticScores =
                    aiServiceClient.checkDuplicateSimilarity(
                            sourceText,
                            candidateTexts
                    );

            System.out.println("Semantic scores: " + semanticScores);

            double bestSemanticScore = 0.0;
            Issue bestCandidate = null;

            for (int i = 0; i < semanticScores.size() && i < candidates.size(); i++) {
                double score = semanticScores.get(i);

                if (score > bestSemanticScore) {
                    bestSemanticScore = score;
                    bestCandidate = candidates.get(i);
                }
            }

            double duplicateLikelihood = 0.0;

            if (bestCandidate != null) {
                double distanceMeters = calculateDistanceMeters(
                        sourceIssue.getLatitude(),
                        sourceIssue.getLongitude(),
                        bestCandidate.getLatitude(),
                        bestCandidate.getLongitude()
                );

                double geoScore = calculateGeoScore(distanceMeters);
                double timeScore = calculateTimeScore(bestCandidate.getCreatedAt());

                duplicateLikelihood = clamp(
                        (bestSemanticScore * 0.5) +
                        (geoScore * 0.35) +
                        (timeScore * 0.15)
                );

                if (duplicateLikelihood >= DUPLICATE_WARNING_THRESHOLD) {
                    sourceIssue.setPossibleDuplicateIssueId(bestCandidate.getId());
                } else {
                    sourceIssue.setPossibleDuplicateIssueId(null);
                }

                System.out.println("Best candidate: " + bestCandidate.getId());
                System.out.println("Best semantic score: " + bestSemanticScore);
                System.out.println("Geo score: " + geoScore);
                System.out.println("Time score: " + timeScore);
                System.out.println("Final duplicate likelihood: " + duplicateLikelihood);
            } else {
                sourceIssue.setPossibleDuplicateIssueId(null);
            }

            sourceIssue.setDuplicateLikelihood(round2(duplicateLikelihood));

            return issueRepository.save(sourceIssue);

        } catch (Exception e) {

            System.out.println(
                    "Duplicate semantic check failed, using fallback: " +
                    e.getMessage()
            );

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
            List<Issue> nearbyIssues = issueRepository.findNearbyIssues(
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

                double geoScore = calculateGeoScore(
                        calculateDistanceMeters(
                                issue.getLatitude(),
                                issue.getLongitude(),
                                candidate.getLatitude(),
                                candidate.getLongitude()
                        )
                );

                double timeScore = candidate.getCreatedAt() == null
                        ? 0.1
                        : calculateTimeScore(candidate.getCreatedAt());

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
        StringBuilder builder = new StringBuilder();

        appendText(builder, issue.getTitle());
        appendText(builder, issue.getDescription());

        if (issue.getCategory() != null) {
            appendText(builder, issue.getCategory().name());
        }

        appendText(builder, issue.getAiDescription());
        appendText(builder, issue.getAiRawCaption());
        appendText(builder, issue.getAiClipLabel());
        appendText(builder, issue.getAddress());

        return builder.toString().trim();
    }

    private void appendText(StringBuilder builder, String value) {
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

        long hours = ChronoUnit.HOURS.between(createdAt, LocalDateTime.now());

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
        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
            return Double.MAX_VALUE;
        }

        final double earthRadius = 6_371_000.0;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) *
                Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadius * c;
    }

    private double clamp(double value) {
        return Math.max(0.0, Math.min(value, 1.0));
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String buildImageUrl(String mediaUrl) {

        if (mediaUrl == null || mediaUrl.isBlank()) {
            return null;
        }

        if (
                mediaUrl.startsWith("http://") ||
                mediaUrl.startsWith("https://")
        ) {
            return mediaUrl;
        }

        return "http://localhost:8031/uploads/" + mediaUrl;
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
                .map(media -> buildImageUrl(media.getMediaUrl()))
                .toList();
    }

    private String getPrimaryImageUrl(Issue issue) {

        List<String> mediaUrls = getMediaUrls(issue);

        if (mediaUrls.isEmpty()) {
            return null;
        }

        return mediaUrls.get(0);
    }

    private IssueResponse mapToDetailedResponse(Issue issue) {

        List<String> mediaUrls = getMediaUrls(issue);

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
                        issue.getReportedBy() == null
                                ? null
                                : UserSummary.builder()
                                        .id(issue.getReportedBy().getId())
                                        .name(issue.getReportedBy().getName())
                                        .build()
                )
                .assignedTo(
                        issue.getAssignedTo() == null
                                ? null
                                : UserSummary.builder()
                                        .id(issue.getAssignedTo().getId())
                                        .name(issue.getAssignedTo().getName())
                                        .build()
                )
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .imageUrl(mediaUrls.isEmpty() ? null : mediaUrls.get(0))
                .mediaUrls(mediaUrls)
                .aiDescription(issue.getAiDescription())
                .aiConfidenceScore(issue.getAiConfidenceScore())
                .fakeReportLikelihood(issue.getFakeReportLikelihood())
                .severityConfidence(issue.getSeverityConfidence())
                .duplicateLikelihood(issue.getDuplicateLikelihood())
                .possibleDuplicateIssueId(issue.getPossibleDuplicateIssueId())
                .aiReasoning(issue.getAiReasoning())
                .build();
    }
}

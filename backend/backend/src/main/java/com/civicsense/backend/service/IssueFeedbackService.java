package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueFeedbackRequest;
import com.civicsense.backend.dto.IssueFeedbackResponse;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueFeedback;
import com.civicsense.backend.entity.IssueFeedbackRating;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.repository.IssueFeedbackRepository;
import com.civicsense.backend.repository.IssueRepository;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.security.CustomUserDetails;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueFeedbackService {

    private static final int MAX_COMMENT_LENGTH = 500;

    private final IssueRepository issueRepository;
    private final IssueFeedbackRepository issueFeedbackRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public IssueFeedbackResponse submitCitizenFeedback(
            UUID issueId,
            IssueFeedbackRequest request
    ) {
        User citizen = getCurrentUser();

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateCitizenOwnsIssue(citizen, issue);

        if (issue.getStatus() != IssueStatus.RESOLVED) {
            throw new RuntimeException("Feedback can be submitted only after the issue is resolved");
        }

        if (issueFeedbackRepository.existsByIssueId(issueId)) {
            throw new RuntimeException("Feedback has already been submitted for this issue");
        }

        if (request == null || request.getRating() == null) {
            throw new RuntimeException("Feedback rating is required");
        }

        IssueFeedback feedback = IssueFeedback.builder()
                .issue(issue)
                .citizen(citizen)
                .rating(request.getRating())
                .comment(sanitizeComment(request.getComment()))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        IssueFeedback saved = issueFeedbackRepository.save(feedback);

        notificationService.notifyFeedbackSubmitted(issue);

        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public IssueFeedbackResponse getIssueFeedback(UUID issueId) {
        User currentUser = getCurrentUser();

        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        validateCanViewFeedback(currentUser, issue);

        return issueFeedbackRepository.findByIssueId(issueId)
                .map(this::mapToResponse)
                .orElse(null);
    }

    private void validateCanViewFeedback(User currentUser, Issue issue) {
        if (currentUser == null || currentUser.getRole() == null) {
            throw new RuntimeException("Authenticated user not found");
        }

        if (currentUser.getRole() == UserRole.ADMIN ||
                currentUser.getRole() == UserRole.SUPERVISOR ||
                currentUser.getRole() == UserRole.OFFICER) {
            return;
        }

        validateCitizenOwnsIssue(currentUser, issue);
    }

    private void validateCitizenOwnsIssue(User citizen, Issue issue) {
        if (citizen == null || issue == null || issue.getReportedBy() == null) {
            throw new RuntimeException("You can access feedback only for your own reports");
        }

        if (!issue.getReportedBy().getId().equals(citizen.getId())) {
            throw new RuntimeException("You can access feedback only for your own reports");
        }
    }

    private String sanitizeComment(String comment) {
        if (comment == null) {
            return null;
        }

        String trimmed = comment.trim();

        if (trimmed.isBlank()) {
            return null;
        }

        if (trimmed.length() > MAX_COMMENT_LENGTH) {
            throw new RuntimeException("Feedback comment must be 500 characters or less");
        }

        return trimmed;
    }

    private IssueFeedbackResponse mapToResponse(IssueFeedback feedback) {
        if (feedback == null) {
            return null;
        }

        User citizen = feedback.getCitizen();
        IssueFeedbackRating rating = feedback.getRating();

        return IssueFeedbackResponse.builder()
                .id(feedback.getId())
                .issueId(
                        feedback.getIssue() == null
                                ? null
                                : feedback.getIssue().getId()
                )
                .citizenId(citizen == null ? null : citizen.getId())
                .citizenName(resolveUserName(citizen))
                .rating(rating == null ? null : rating.name())
                .ratingLabel(resolveRatingLabel(rating))
                .comment(feedback.getComment())
                .createdAt(feedback.getCreatedAt())
                .updatedAt(feedback.getUpdatedAt())
                .build();
    }

    private String resolveRatingLabel(IssueFeedbackRating rating) {
        if (rating == null) {
            return null;
        }

        return switch (rating) {
            case SATISFIED -> "Satisfied";
            case NOT_SATISFIED -> "Not satisfied";
        };
    }

    private String resolveUserName(User user) {
        if (user == null) {
            return "";
        }

        if (user.getName() != null && !user.getName().isBlank()) {
            return user.getName();
        }

        return user.getEmail() == null ? "" : user.getEmail();
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new RuntimeException("Invalid authenticated user");
        }

        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }
}

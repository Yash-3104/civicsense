package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueActivityResponse;
import com.civicsense.backend.dto.UserSummary;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueActivity;
import com.civicsense.backend.entity.IssueActivityType;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.repository.IssueActivityRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueActivityService {

    private final IssueActivityRepository issueActivityRepository;

    @Transactional
    public void recordActivity(
            Issue issue,
            IssueActivityType type,
            String message,
            User actor
    ) {

        if (issue == null || issue.getId() == null || type == null) {
            return;
        }

        IssueActivity activity =
                IssueActivity.builder()
                        .issue(issue)
                        .type(type)
                        .message(
                                message == null || message.isBlank()
                                        ? type.name().replace("_", " ")
                                        : message
                        )
                        .actor(actor)
                        .actorName(resolveActorName(actor))
                        .actorRole(
                                actor == null || actor.getRole() == null
                                        ? "SYSTEM"
                                        : actor.getRole().name()
                        )
                        .createdAt(LocalDateTime.now())
                        .build();

        issueActivityRepository.save(activity);
    }

    @Transactional(readOnly = true)
    public List<IssueActivityResponse> getTimeline(UUID issueId) {

        return issueActivityRepository
                .findByIssueIdOrderByCreatedAtAsc(issueId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    private IssueActivityResponse mapToResponse(IssueActivity activity) {

        User actor =
                activity.getActor();

        return IssueActivityResponse.builder()
                .id(activity.getId())
                .type(
                        activity.getType() == null
                                ? null
                                : activity.getType().name()
                )
                .message(activity.getMessage())
                .actor(
                        actor == null
                                ? null
                                : UserSummary.builder()
                                        .id(actor.getId())
                                        .name(actor.getName())
                                        .build()
                )
                .actorName(activity.getActorName())
                .actorRole(activity.getActorRole())
                .metadata(activity.getMetadata())
                .createdAt(activity.getCreatedAt())
                .build();
    }

    private String resolveActorName(User actor) {

        if (actor == null) {
            return "System";
        }

        if (actor.getName() != null && !actor.getName().isBlank()) {
            return actor.getName();
        }

        if (actor.getEmail() != null && !actor.getEmail().isBlank()) {
            return actor.getEmail();
        }

        return "User";
    }
}

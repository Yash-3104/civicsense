package com.civicsense.backend.service;

import com.civicsense.backend.dto.RealtimeIssueEvent;
import com.civicsense.backend.entity.Issue;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RealtimeEventService {

    private final SimpMessagingTemplate messagingTemplate;

    private static final String ISSUE_TOPIC = "/topic/issues";

    public void publishIssueEvent(String type, Issue issue) {

        if (issue == null) {
            return;
        }

        RealtimeIssueEvent event = RealtimeIssueEvent.builder()
                .type(type)
                .issueId(issue.getId())
                .title(issue.getTitle())
                .status(issue.getStatus() == null ? null : issue.getStatus().name())
                .severity(issue.getSeverity() == null ? null : issue.getSeverity().name())
                .category(issue.getCategory() == null ? null : issue.getCategory().name())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .timestamp(LocalDateTime.now())
                .build();

        messagingTemplate.convertAndSend(ISSUE_TOPIC, event);
    }

    public void publishIssueDeleted(UUID issueId) {

        RealtimeIssueEvent event = RealtimeIssueEvent.builder()
                .type("ISSUE_DELETED")
                .issueId(issueId)
                .timestamp(LocalDateTime.now())
                .build();

        messagingTemplate.convertAndSend(ISSUE_TOPIC, event);
    }
}
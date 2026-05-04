package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueImageUploadedEvent;
import com.civicsense.backend.entity.*;
import com.civicsense.backend.repository.IssueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class IssueImageUploadedConsumer {

    private final AiServiceClient aiServiceClient;
    private final IssueRepository issueRepository;

    @KafkaListener(
            topics = "${app.kafka.topic.issue-image-uploaded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleImageUploaded(IssueImageUploadedEvent event) {

        try {
            Issue issue = issueRepository.findById(event.getIssueId())
                    .orElseThrow(() -> new RuntimeException("Issue not found"));

            Map<String, Object> result =
                    aiServiceClient.analyzeImageFromPath(event.getFilePath());

            Boolean isValid = (Boolean) result.get("is_valid_issue");
            String severity = (String) result.get("severity");

            if (Boolean.FALSE.equals(isValid)) {
                issue.setStatus(IssueStatus.REJECTED);
            } else {
                issue.setStatus(IssueStatus.VERIFIED);
                issue.setSeverity(SeverityLevel.valueOf(severity));
            }

            issueRepository.save(issue);

            System.out.println("Kafka AI processing completed for issue: " + event.getIssueId());

        } catch (Exception e) {
            System.out.println("Kafka AI processing failed: " + e.getMessage());
        }
    }
}
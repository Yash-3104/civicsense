package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueImageUploadedEvent;
import com.civicsense.backend.entity.*;
import com.civicsense.backend.repository.IssueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
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

            System.out.println();
            System.out.println("================ KAFKA AI PROCESS START ================");
            System.out.println("Issue ID: " + event.getIssueId());
            System.out.println("File path: " + event.getFilePath());
            System.out.println("File name: " + event.getFileName());

            Issue issue = issueRepository.findById(event.getIssueId())
                    .orElseThrow(() ->
                            new RuntimeException("Issue not found"));

            Map<String, Object> result =
                    aiServiceClient.analyzeImageFromPath(event.getFilePath());

            System.out.println("AI RESULT: " + result);

            if (result == null) {
                throw new RuntimeException("AI service returned null response");
            }

            Boolean isValid =
                    (Boolean) result.get("is_valid_issue");

            String severity =
                    (String) result.get("severity");

            String aiDescription =
                    (String) result.get("description");

            String rawCaption =
                    (String) result.get("raw_caption");

            System.out.println("AI valid issue: " + isValid);
            System.out.println("AI severity: " + severity);
            System.out.println("AI description: " + aiDescription);
            System.out.println("AI raw caption: " + rawCaption);

            if (aiDescription == null || aiDescription.isBlank()) {
                aiDescription = "AI analysis completed successfully.";
            }

            issue.setAiDescription(aiDescription);

            if (Boolean.FALSE.equals(isValid)) {

                issue.setStatus(IssueStatus.REJECTED);

            } else {

                issue.setStatus(IssueStatus.VERIFIED);

                if (severity != null && !severity.isBlank()) {
                    issue.setSeverity(SeverityLevel.valueOf(severity));
                }
            }

            issue.setUpdatedAt(LocalDateTime.now());

            Issue savedIssue = issueRepository.save(issue);

            System.out.println(
                    "SAVED AI DESCRIPTION: " +
                            savedIssue.getAiDescription()
            );

            System.out.println("Kafka AI processing completed for issue: " + event.getIssueId());
            System.out.println("================ KAFKA AI PROCESS SUCCESS ================");
            System.out.println();

        } catch (Exception e) {

            System.out.println();
            System.out.println("================ KAFKA AI PROCESS FAILED ================");
            e.printStackTrace();
            System.out.println();
        }
    }
}
package com.civicsense.backend.service;

import com.civicsense.backend.entity.*;
import com.civicsense.backend.repository.IssueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AsyncAiProcessor {

    private final AiServiceClient aiServiceClient;
    private final IssueRepository issueRepository;

    @Async
    public void processIssue(UUID issueId, String filePath) {

        try {
            Issue issue = issueRepository.findById(issueId)
                    .orElseThrow(() -> new RuntimeException("Issue not found"));

            // Call AI (simulate or real)
            Map<String, Object> result = aiServiceClient.analyzeImageFromPath(filePath);

            Boolean isValid = (Boolean) result.get("is_valid_issue");
            String severity = (String) result.get("severity");

            if (!isValid) {
                issue.setStatus(IssueStatus.REJECTED);
            } else {
                issue.setSeverity(SeverityLevel.valueOf(severity));
                issue.setStatus(IssueStatus.VERIFIED);
            }

            issueRepository.save(issue);

            System.out.println("AI processing completed for issue: " + issueId);

        } catch (Exception e) {
            System.out.println("Async AI processing failed: " + e.getMessage());
        }
    }
}
package com.civicsense.backend.service;

import com.civicsense.backend.entity.*;
import com.civicsense.backend.repository.IssueRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
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

            System.out.println(
                    "\n================ AI PROCESS START ================\n"
            );

            System.out.println("Issue ID: " + issueId);

            System.out.println("File Path: " + filePath);

            Issue issue = issueRepository.findById(issueId)
                    .orElseThrow(() ->
                            new RuntimeException("Issue not found"));

            // ---------------------------------------------------
            // AI REQUEST
            // ---------------------------------------------------

            Map<String, Object> result =
                    aiServiceClient.analyzeImageFromPath(filePath);

            System.out.println("AI RESULT: " + result);

            if (result == null) {
                throw new RuntimeException(
                        "AI service returned null response"
                );
            }

            Boolean isValid =
                    (Boolean) result.get("is_valid_issue");

            String severity =
                    (String) result.get("severity");

            String aiSummary =
                    (String) result.get("description");

            String rawCaption =
                    (String) result.get("raw_caption");

            System.out.println("AI VALID: " + isValid);

            System.out.println("AI SEVERITY: " + severity);

            System.out.println("AI DESCRIPTION: " + aiSummary);

            System.out.println("AI CAPTION: " + rawCaption);

            // ---------------------------------------------------
            // FALLBACK DESCRIPTION
            // ---------------------------------------------------

            if (aiSummary == null || aiSummary.isBlank()) {

                aiSummary =
                        "AI analysis completed successfully.";

                System.out.println(
                        "Fallback AI description used."
                );
            }

            // ---------------------------------------------------
            // SAVE AI DESCRIPTION
            // ---------------------------------------------------

            issue.setAiDescription(aiSummary);

            // ---------------------------------------------------
            // STATUS / SEVERITY
            // ---------------------------------------------------

            if (Boolean.FALSE.equals(isValid)) {

                issue.setStatus(IssueStatus.REJECTED);

            } else {

                if (severity != null) {

                    issue.setSeverity(
                            SeverityLevel.valueOf(severity)
                    );
                }

                issue.setStatus(IssueStatus.VERIFIED);
            }

            issue.setUpdatedAt(LocalDateTime.now());

            // ---------------------------------------------------
            // SAVE ISSUE
            // ---------------------------------------------------

            Issue savedIssue =
                    issueRepository.save(issue);

            System.out.println(
                    "SAVED AI DESCRIPTION: " +
                    savedIssue.getAiDescription()
            );

            System.out.println(
                    "\n================ AI PROCESS SUCCESS ================\n"
            );

        } catch (Exception e) {

            System.out.println(
                    "\n================ AI PROCESS FAILED ================\n"
            );

            e.printStackTrace();
        }
    }
}
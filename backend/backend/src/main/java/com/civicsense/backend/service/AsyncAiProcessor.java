package com.civicsense.backend.service;

import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.SeverityLevel;
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

            Double aiConfidenceScore =
                    getDoubleValue(result, "confidence_score");

            Double fakeReportLikelihood =
                    getDoubleValue(result, "fake_report_likelihood");

            Double severityConfidence =
                    getDoubleValue(result, "severity_confidence");

            Double duplicateLikelihood =
                    getDoubleValue(result, "duplicate_likelihood");

            String aiReasoning =
                    getReasoningText(result);

            System.out.println("AI VALID: " + isValid);

            System.out.println("AI SEVERITY: " + severity);

            System.out.println("AI DESCRIPTION: " + aiSummary);

            System.out.println("AI CAPTION: " + rawCaption);

            if (aiSummary == null || aiSummary.isBlank()) {

                aiSummary =
                        "AI analysis completed successfully.";

                System.out.println(
                        "Fallback AI description used."
                );
            }

            issue.setAiDescription(aiSummary);

            issue.setAiConfidenceScore(aiConfidenceScore);
            issue.setFakeReportLikelihood(fakeReportLikelihood);
            issue.setSeverityConfidence(severityConfidence);
            issue.setDuplicateLikelihood(duplicateLikelihood);
            issue.setAiReasoning(aiReasoning);

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

            Issue savedIssue =
                    issueRepository.save(issue);

            System.out.println(
                    "SAVED AI DESCRIPTION: " +
                    savedIssue.getAiDescription()
            );

            System.out.println(
                    "AI CONFIDENCE SCORE: " +
                    savedIssue.getAiConfidenceScore()
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

    private Double getDoubleValue(Map<String, Object> result, String key) {

        Object value = result.get(key);

        if (value == null) {
            return null;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        try {
            return Double.parseDouble(value.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private String getReasoningText(Map<String, Object> result) {

        Object value = result.get("reasoning");

        if (value == null) {
            return null;
        }

        if (value instanceof java.util.List<?> list) {
            return list.stream()
                    .map(Object::toString)
                    .toList()
                    .toString();
        }

        return value.toString();
    }
}
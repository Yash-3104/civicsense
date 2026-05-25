package com.civicsense.backend.service;

import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.SeverityLevel;
import com.civicsense.backend.repository.IssueRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncAiProcessor {

    private final AiServiceClient aiServiceClient;
    private final IssueRepository issueRepository;

    @Async
    public void processIssue(UUID issueId, String filePath) {

        try {

            log.info("Async AI processing started for issue: {}", issueId);
            log.debug("Async AI file path for issue {}: {}", issueId, filePath);

            Issue issue = issueRepository.findById(issueId)
                    .orElseThrow(() ->
                            new RuntimeException("Issue not found"));

            Map<String, Object> result =
                    aiServiceClient.analyzeImageFromPath(filePath);

            log.debug("AI result for issue {}: {}", issueId, result);

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

            log.debug("AI valid for issue {}: {}", issueId, isValid);
            log.debug("AI severity for issue {}: {}", issueId, severity);
            log.debug("AI description for issue {}: {}", issueId, aiSummary);
            log.debug("AI caption for issue {}: {}", issueId, rawCaption);

            if (aiSummary == null || aiSummary.isBlank()) {

                aiSummary =
                        "AI analysis completed successfully.";

                log.debug("Fallback AI description used for issue: {}", issueId);
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

            log.debug("Saved AI description for issue {}: {}", issueId, savedIssue.getAiDescription());
            log.debug("AI confidence score for issue {}: {}", issueId, savedIssue.getAiConfidenceScore());
            log.info("Async AI processing completed for issue: {}", issueId);

        } catch (Exception e) {

            log.error("Async AI processing failed for issue: {}", issueId, e);
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

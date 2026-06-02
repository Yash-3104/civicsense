package com.civicsense.backend.service;

import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.dto.RealtimeEventType;
import com.civicsense.backend.repository.IssueRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.ObjectProvider;
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
    private final ObjectProvider<IssueService> issueServiceProvider;
    private final RealtimeEventService realtimeEventService;

    @Async
    public void processIssue(UUID issueId, String filePath) {
        processIssueNow(issueId, filePath);
    }

    public void processIssueNow(UUID issueId, String filePath) {

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
                    getStringValue(result, "raw_caption");

            if (rawCaption == null) {
                rawCaption = getStringValue(result, "caption");
            }

            String clipLabel = getClipLabel(result);

            Double aiConfidenceScore =
                    getDoubleValue(result, "confidence_score");

            Double fakeReportLikelihood =
                    getDoubleValue(result, "fake_report_likelihood");

            Double severityConfidence =
                    getDoubleValue(result, "severity_confidence");

            String aiReasoning =
                    getReasoningText(result);

            log.debug("AI valid for issue {}: {}", issueId, isValid);
            log.debug("AI severity for issue {}: {}", issueId, severity);
            log.debug("AI description for issue {}: {}", issueId, aiSummary);
            log.debug("AI caption for issue {}: {}", issueId, rawCaption);
            log.debug("AI CLIP label for issue {}: {}", issueId, clipLabel);

            if (aiSummary == null || aiSummary.isBlank()) {

                aiSummary =
                        "AI analysis completed successfully.";

                log.debug("Fallback AI description used for issue: {}", issueId);
            }

            issue.setAiDescription(aiSummary);
            issue.setAiRawCaption(rawCaption);
            issue.setAiClipLabel(clipLabel);

            issue.setAiConfidenceScore(aiConfidenceScore);
            issue.setFakeReportLikelihood(fakeReportLikelihood);
            issue.setSeverityConfidence(severityConfidence);
            issue.setAiReasoning(aiReasoning);

            if (Boolean.FALSE.equals(isValid)) {

                issue.setStatus(IssueStatus.REJECTED);

            } else {

                issue.setStatus(IssueStatus.VERIFIED);

                // Keep operational severity user/admin-controlled. AI severity remains metadata.
                log.debug("AI suggested severity ignored for final issue severity: {}", severity);
            }

            issue.setUpdatedAt(LocalDateTime.now());

            Issue savedIssue =
                    issueRepository.save(issue);

            Issue duplicateRefinedIssue =
                    issueServiceProvider.getObject()
                            .recomputeDuplicateLikelihood(savedIssue.getId());

            realtimeEventService.publishIssueEvent(
                    RealtimeEventType.AI_ANALYSIS_COMPLETED,
                    duplicateRefinedIssue
            );

            log.debug("Saved AI description for issue {}: {}", issueId, duplicateRefinedIssue.getAiDescription());
            log.debug("AI confidence score for issue {}: {}", issueId, duplicateRefinedIssue.getAiConfidenceScore());
            log.debug("Duplicate likelihood after AI for {}: {}", issueId, duplicateRefinedIssue.getDuplicateLikelihood());
            log.debug("Possible duplicate issue id after AI for {}: {}", issueId, duplicateRefinedIssue.getPossibleDuplicateIssueId());
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

    private String getStringValue(Map<String, Object> result, String key) {

        Object value = result.get(key);

        if (value == null) {
            return null;
        }

        String text = value.toString();

        if (text.isBlank()) {
            return null;
        }

        return text;
    }

    private String getClipLabel(Map<String, Object> result) {

        String directLabel = getStringValue(result, "clip_label");

        if (directLabel != null) {
            return directLabel;
        }

        String topLabel = getStringValue(result, "top_label");

        if (topLabel != null) {
            return topLabel;
        }

        Object classification = result.get("classification");

        if (classification instanceof Map<?, ?> map) {
            Object nestedTopLabel = map.get("top_label");

            if (nestedTopLabel != null && !nestedTopLabel.toString().isBlank()) {
                return nestedTopLabel.toString();
            }

            Object label = map.get("label");

            if (label != null && !label.toString().isBlank()) {
                return label.toString();
            }
        }

        return null;
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

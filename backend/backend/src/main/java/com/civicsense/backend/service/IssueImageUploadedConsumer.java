package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueImageUploadedEvent;
import com.civicsense.backend.dto.RealtimeEventType;
import com.civicsense.backend.entity.Issue;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.repository.IssueRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class IssueImageUploadedConsumer {

    private final AiServiceClient aiServiceClient;
    private final IssueRepository issueRepository;
    private final IssueService issueService;
    private final RealtimeEventService realtimeEventService;

    @KafkaListener(
            topics = "${app.kafka.topic.issue-image-uploaded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleImageUploaded(IssueImageUploadedEvent event) {

        try {

            log.info("Kafka AI processing started for issue: {}", event.getIssueId());
            log.debug("Kafka AI image file path: {}", event.getFilePath());
            log.debug("Kafka AI image file name: {}", event.getFileName());

            Issue issue = issueRepository.findById(event.getIssueId())
                    .orElseThrow(() ->
                            new RuntimeException("Issue not found"));

            Map<String, Object> result =
                    aiServiceClient.analyzeImageFromPath(event.getFilePath());

            log.debug("AI result for issue {}: {}", event.getIssueId(), result);

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

            log.debug("AI valid issue for {}: {}", event.getIssueId(), isValid);
            log.debug("AI severity for {}: {}", event.getIssueId(), severity);
            log.debug("AI description for {}: {}", event.getIssueId(), aiDescription);
            log.debug("AI raw caption for {}: {}", event.getIssueId(), rawCaption);
            log.debug("AI CLIP label for {}: {}", event.getIssueId(), clipLabel);

            if (aiDescription == null || aiDescription.isBlank()) {
                aiDescription = "AI analysis completed successfully.";
            }

            issue.setAiDescription(aiDescription);
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

                // Do NOT overwrite the citizen/admin selected severity here.
                // AI severity is stored as confidence metadata and used for suggestions,
                // but the final issue severity remains the user-selected operational value.
                log.debug("AI suggested severity ignored for final issue severity: {}", severity);
            }

            issue.setUpdatedAt(LocalDateTime.now());

            Issue savedIssue = issueRepository.save(issue);

            // Duplicate Detection v2: rerun after AI metadata is saved.
            Issue duplicateRefinedIssue =
                    issueService.recomputeDuplicateLikelihood(savedIssue.getId());

            realtimeEventService.publishIssueEvent(
                    RealtimeEventType.AI_ANALYSIS_COMPLETED,
                    duplicateRefinedIssue
            );

            log.debug("Saved AI description for {}: {}", event.getIssueId(), duplicateRefinedIssue.getAiDescription());
            log.debug("AI confidence score for {}: {}", event.getIssueId(), duplicateRefinedIssue.getAiConfidenceScore());
            log.debug("Duplicate likelihood after AI for {}: {}", event.getIssueId(), duplicateRefinedIssue.getDuplicateLikelihood());
            log.debug("Possible duplicate issue id after AI for {}: {}", event.getIssueId(), duplicateRefinedIssue.getPossibleDuplicateIssueId());
            log.info("Kafka AI processing completed for issue: {}", event.getIssueId());

        } catch (Exception e) {

            log.error("Kafka AI processing failed for issue: {}", event.getIssueId(), e);
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

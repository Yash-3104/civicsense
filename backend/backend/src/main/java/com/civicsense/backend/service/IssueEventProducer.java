package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueImageUploadedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class IssueEventProducer {

    private final KafkaTemplate<String, IssueImageUploadedEvent> kafkaTemplate;

    @Value("${app.kafka.topic.issue-image-uploaded}")
    private String issueImageUploadedTopic;

    public void publishImageUploaded(IssueImageUploadedEvent event) {
        kafkaTemplate.send(
                issueImageUploadedTopic,
                event.getIssueId().toString(),
                event
        );
    }
}
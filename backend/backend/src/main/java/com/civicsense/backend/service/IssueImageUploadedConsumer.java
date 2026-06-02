package com.civicsense.backend.service;

import com.civicsense.backend.dto.IssueImageUploadedEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("kafka-rollback")
@RequiredArgsConstructor
@Slf4j
public class IssueImageUploadedConsumer {

    private final AsyncAiProcessor asyncAiProcessor;

    @KafkaListener(
            topics = "${app.kafka.topic.issue-image-uploaded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleImageUploaded(IssueImageUploadedEvent event) {

        log.info("Legacy Kafka image event received for issue: {}", event.getIssueId());
        asyncAiProcessor.processIssueNow(event.getIssueId(), event.getFilePath());
    }
}

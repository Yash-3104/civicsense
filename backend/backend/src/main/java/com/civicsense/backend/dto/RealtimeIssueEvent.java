package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class RealtimeIssueEvent {

    private String type;

    private UUID issueId;

    private String title;

    private String status;

    private String severity;

    private String category;

    private Double latitude;

    private Double longitude;

    private LocalDateTime timestamp;
}
package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class CitizenTimelineItemResponse {

    private UUID id;

    private String type;

    private String title;

    private String message;

    private LocalDateTime createdAt;
}

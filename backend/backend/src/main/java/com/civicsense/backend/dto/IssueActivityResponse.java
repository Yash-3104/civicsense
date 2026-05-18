package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class IssueActivityResponse {

    private UUID id;

    private String type;

    private String message;

    private UserSummary actor;

    private String actorName;

    private String actorRole;

    private String metadata;

    private LocalDateTime createdAt;
}

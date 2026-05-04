package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class IssueResponse {

    private UUID id;
    private String title;
    private String description;

    private String category;
    private String status;
    private String severity;

    private Double latitude;
    private Double longitude;
    private String address;

    private UserSummary reportedBy;

    private LocalDateTime createdAt;
}
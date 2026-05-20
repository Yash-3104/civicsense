package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class PublicIssueSummary {
    private UUID id;
    private String title;
    private String description;
    private String category;
    private String status;
    private String severity;
    private String address;
    private Double latitude;
    private Double longitude;
    private String imageUrl;
    private String resolutionImageUrl;
    private String assignedDepartment;
    private Boolean slaBreached;
    private Boolean escalated;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}

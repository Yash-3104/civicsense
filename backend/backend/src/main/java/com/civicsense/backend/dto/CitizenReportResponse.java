package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CitizenReportResponse {

    private UUID id;

    private String title;

    private String description;

    private String category;

    private String status;

    private String citizenStatusLabel;

    private String severity;

    private String address;

    private Double latitude;

    private Double longitude;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String imageUrl;

    private List<String> mediaUrls;

    private String assignedDepartment;

    private LocalDateTime assignedAt;

    private LocalDateTime slaDeadline;

    private Boolean slaBreached;

    private String slaStatus;

    private String slaMessage;

    private String resolutionNotes;

    private String resolutionImageUrl;

    private LocalDateTime resolvedAt;

    private String rejectionReason;

    private String rejectionReasonLabel;

    private String rejectionNotes;

    private LocalDateTime rejectedAt;

    private List<CitizenTimelineItemResponse> timeline;
}

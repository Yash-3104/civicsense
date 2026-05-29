package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class SupervisorIssueQueueItem {
    private UUID id;
    private String title;
    private String category;
    private String status;
    private String severity;
    private String address;
    private Double latitude;
    private Double longitude;
    private UserSummary assignedTo;
    private String assignedDepartment;
    private LocalDateTime assignedAt;
    private LocalDateTime slaDeadline;
    private Boolean slaBreached;
    private String escalationReason;
    private String escalationLevel;
    private LocalDateTime escalatedAt;
    private UserSummary escalatedBy;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
}

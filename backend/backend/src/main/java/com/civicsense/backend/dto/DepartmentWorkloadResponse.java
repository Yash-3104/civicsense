package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DepartmentWorkloadResponse {
    private String department;
    private Long assignedCount;
    private Long inProgressCount;
    private Long pendingClosureCount;
    private Long resolvedCount;
    private Long slaBreachedCount;
    private Long escalatedCount;
    private Long totalActiveCount;
}

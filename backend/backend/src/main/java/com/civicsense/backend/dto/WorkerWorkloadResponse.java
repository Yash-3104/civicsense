package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class WorkerWorkloadResponse {
    private UUID workerId;
    private String workerName;
    private String workerEmail;
    private String role;
    private List<String> departments;
    private Long assignedCount;
    private Long inProgressCount;
    private Long pendingClosureCount;
    private Long resolvedCount;
    private Long slaBreachedCount;
    private Long escalatedCount;
    private Long totalActiveCount;
}

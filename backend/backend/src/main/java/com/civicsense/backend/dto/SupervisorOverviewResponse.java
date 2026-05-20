package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class SupervisorOverviewResponse {
    private List<String> supervisorDepartments;
    private Long activeIssues;
    private Long assignedIssues;
    private Long inProgressIssues;
    private Long pendingClosureIssues;
    private Long resolvedIssues;
    private Long slaBreachedIssues;
    private Long escalatedIssues;
    private Long activeWorkers;
    private List<SupervisorIssueQueueItem> taskQueue;
    private List<SupervisorIssueQueueItem> slaQueue;
    private List<WorkerWorkloadResponse> workerWorkloads;
    private List<DepartmentWorkloadResponse> departmentWorkloads;
}

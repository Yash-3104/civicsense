package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class WorkerDepartmentResponse {

    private UUID id;

    private UUID workerId;

    private String workerName;

    private String workerEmail;

    private String department;

    private LocalDateTime createdAt;
}

package com.civicsense.backend.dto;

import lombok.Data;

import java.util.UUID;
import com.civicsense.backend.entity.Department;

@Data
public class AssignIssueRequest {

    private UUID workerId;

    private Department department;
}
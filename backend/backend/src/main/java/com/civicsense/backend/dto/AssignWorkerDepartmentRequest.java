package com.civicsense.backend.dto;

import com.civicsense.backend.entity.Department;
import lombok.Data;

@Data
public class AssignWorkerDepartmentRequest {

    private Department department;
}

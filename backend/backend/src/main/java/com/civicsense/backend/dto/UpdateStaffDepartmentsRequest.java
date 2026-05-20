package com.civicsense.backend.dto;

import com.civicsense.backend.entity.Department;
import lombok.Data;
import java.util.List;

@Data
public class UpdateStaffDepartmentsRequest {
    private List<Department> departments;
}

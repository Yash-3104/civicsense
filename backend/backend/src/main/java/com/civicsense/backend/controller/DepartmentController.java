package com.civicsense.backend.controller;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.IssueCategory;
import com.civicsense.backend.util.DepartmentRouting;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    @GetMapping("/{category}")
    public List<Department> getDepartments(
            @PathVariable IssueCategory category
    ) {

        return DepartmentRouting
                .getDepartmentsForCategory(category);
    }
}
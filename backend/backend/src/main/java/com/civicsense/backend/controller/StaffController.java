package com.civicsense.backend.controller;

import com.civicsense.backend.dto.CreateStaffRequest;
import com.civicsense.backend.dto.StaffResponse;
import com.civicsense.backend.dto.UpdateStaffDepartmentsRequest;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.service.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @GetMapping
    public List<StaffResponse> getStaff() {
        return staffService.getStaff();
    }

    @GetMapping("/{staffId}")
    public StaffResponse getStaffById(@PathVariable UUID staffId) {
        return staffService.getStaffById(staffId);
    }

    @PostMapping
    public ResponseEntity<StaffResponse> createStaff(
            @Valid @RequestBody CreateStaffRequest request
    ) {
        return ResponseEntity.ok(staffService.createStaff(request));
    }

    @PutMapping("/{staffId}/departments")
    public StaffResponse replaceStaffDepartments(
            @PathVariable UUID staffId,
            @RequestBody UpdateStaffDepartmentsRequest request
    ) {
        return staffService.replaceStaffDepartments(staffId, request);
    }

    @PostMapping("/{staffId}/departments/{department}")
    public StaffResponse addStaffDepartment(
            @PathVariable UUID staffId,
            @PathVariable Department department
    ) {
        return staffService.addDepartment(staffId, department);
    }

    @DeleteMapping("/{staffId}/departments/{department}")
    public StaffResponse removeStaffDepartment(
            @PathVariable UUID staffId,
            @PathVariable Department department
    ) {
        return staffService.removeDepartment(staffId, department);
    }
}

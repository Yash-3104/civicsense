package com.civicsense.backend.controller;

import com.civicsense.backend.dto.AssignWorkerDepartmentRequest;
import com.civicsense.backend.dto.WorkerDepartmentResponse;
import com.civicsense.backend.dto.WorkerSummary;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.service.WorkerService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final WorkerService workerService;

    @GetMapping
    public List<WorkerSummary> getAssignableWorkers() {
        return workerService.getAssignableWorkers();
    }

    @GetMapping("/by-department/{department}")
    public List<WorkerSummary> getWorkersByDepartment(
            @PathVariable Department department
    ) {
        return workerService.getWorkersByDepartment(department);
    }

    @GetMapping("/{workerId}/departments")
    public List<WorkerDepartmentResponse> getWorkerDepartments(
            @PathVariable UUID workerId
    ) {
        return workerService.getWorkerDepartments(workerId);
    }

    @PostMapping("/{workerId}/departments")
    public WorkerDepartmentResponse assignWorkerDepartment(
            @PathVariable UUID workerId,
            @RequestBody AssignWorkerDepartmentRequest request
    ) {
        return workerService.assignDepartment(workerId, request);
    }

    @DeleteMapping("/{workerId}/departments/{department}")
    public void removeWorkerDepartment(
            @PathVariable UUID workerId,
            @PathVariable Department department
    ) {
        workerService.removeDepartment(workerId, department);
    }
}

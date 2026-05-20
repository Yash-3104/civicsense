package com.civicsense.backend.service;

import com.civicsense.backend.dto.AssignWorkerDepartmentRequest;
import com.civicsense.backend.dto.WorkerDepartmentResponse;
import com.civicsense.backend.dto.WorkerSummary;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.entity.WorkerDepartment;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.repository.WorkerDepartmentRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkerService {

    private final UserRepository userRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;

    public List<WorkerSummary> getAssignableWorkers() {

        return userRepository
                .findByRoleIn(
                        List.of(
                                UserRole.WORKER,
                                UserRole.OFFICER,
                                UserRole.SUPERVISOR
                        )
                )
                .stream()
                .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::mapToWorkerSummary)
                .toList();
    }

    public List<WorkerSummary> getWorkersByDepartment(Department department) {

        if (department == null) {
            throw new RuntimeException("Department is required");
        }

        return workerDepartmentRepository
                .findByDepartment(department)
                .stream()
                .map(WorkerDepartment::getWorker)
                .filter(this::isAssignableWorker)
                .distinct()
                .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::mapToWorkerSummary)
                .toList();
    }

    public List<WorkerDepartmentResponse> getWorkerDepartments(UUID workerId) {

        User worker =
                getAssignableWorkerOrThrow(workerId);

        return workerDepartmentRepository
                .findByWorkerId(worker.getId())
                .stream()
                .sorted(Comparator.comparing(item -> item.getDepartment().name()))
                .map(this::mapToDepartmentResponse)
                .toList();
    }

    @Transactional
    public WorkerDepartmentResponse assignDepartment(
            UUID workerId,
            AssignWorkerDepartmentRequest request
    ) {

        if (request == null || request.getDepartment() == null) {
            throw new RuntimeException("Department is required");
        }

        User worker =
                getAssignableWorkerOrThrow(workerId);

        if (
                workerDepartmentRepository.existsByWorkerAndDepartment(
                        worker,
                        request.getDepartment()
                )
        ) {
            return workerDepartmentRepository
                    .findByWorkerIdAndDepartment(workerId, request.getDepartment())
                    .map(this::mapToDepartmentResponse)
                    .orElseThrow(() -> new RuntimeException("Worker department mapping not found"));
        }

        WorkerDepartment workerDepartment =
                WorkerDepartment.builder()
                        .worker(worker)
                        .department(request.getDepartment())
                        .createdAt(LocalDateTime.now())
                        .build();

        return mapToDepartmentResponse(
                workerDepartmentRepository.save(workerDepartment)
        );
    }

    @Transactional
    public void removeDepartment(
            UUID workerId,
            Department department
    ) {

        getAssignableWorkerOrThrow(workerId);

        if (department == null) {
            throw new RuntimeException("Department is required");
        }

        workerDepartmentRepository.deleteByWorkerIdAndDepartment(workerId, department);
    }

    public boolean workerBelongsToDepartment(
            UUID workerId,
            Department department
    ) {

        if (workerId == null || department == null) {
            return false;
        }

        return workerDepartmentRepository
                .existsByWorkerIdAndDepartment(workerId, department);
    }

    private User getAssignableWorkerOrThrow(UUID workerId) {

        if (workerId == null) {
            throw new RuntimeException("Worker ID is required");
        }

        User worker =
                userRepository.findById(workerId)
                        .orElseThrow(() -> new RuntimeException("Worker not found"));

        if (!isAssignableWorker(worker)) {
            throw new RuntimeException("Selected user is not eligible for worker assignment");
        }

        return worker;
    }

    private boolean isAssignableWorker(User user) {

        if (user == null || user.getRole() == null) {
            return false;
        }

        return user.getRole() == UserRole.WORKER ||
                user.getRole() == UserRole.OFFICER ||
                user.getRole() == UserRole.SUPERVISOR;
    }

    private WorkerSummary mapToWorkerSummary(User worker) {

        List<String> departments =
                workerDepartmentRepository
                        .findByWorkerId(worker.getId())
                        .stream()
                        .map(workerDepartment ->
                                workerDepartment.getDepartment().name()
                        )
                        .sorted()
                        .toList();

        return WorkerSummary.builder()
                .id(worker.getId())
                .name(worker.getName())
                .email(worker.getEmail())
                .role(worker.getRole().name())
                .departments(departments)
                .build();
    }

    private WorkerDepartmentResponse mapToDepartmentResponse(
            WorkerDepartment workerDepartment
    ) {

        User worker =
                workerDepartment.getWorker();

        return WorkerDepartmentResponse.builder()
                .id(workerDepartment.getId())
                .workerId(worker == null ? null : worker.getId())
                .workerName(worker == null ? null : worker.getName())
                .workerEmail(worker == null ? null : worker.getEmail())
                .department(
                        workerDepartment.getDepartment() == null
                                ? null
                                : workerDepartment.getDepartment().name()
                )
                .createdAt(workerDepartment.getCreatedAt())
                .build();
    }
}

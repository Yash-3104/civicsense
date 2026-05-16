package com.civicsense.backend.controller;

import com.civicsense.backend.dto.WorkerSummary;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final UserRepository userRepository;

    @GetMapping
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
                .map(user ->
                        WorkerSummary.builder()
                                .id(user.getId())
                                .name(user.getName())
                                .role(user.getRole().name())
                                .build()
                )
                .toList();
    }

    @GetMapping("/by-department/{department}")
    public List<WorkerSummary> getWorkersByDepartment(
            @PathVariable Department department
    ) {

        return userRepository
                .findByRoleIn(
                        List.of(
                                UserRole.WORKER,
                                UserRole.OFFICER,
                                UserRole.SUPERVISOR
                        )
                )
                .stream()
                .filter(user ->
                        isWorkerEligibleForDepartment(
                                user.getEmail(),
                                department
                        )
                )
                .map(user ->
                        WorkerSummary.builder()
                                .id(user.getId())
                                .name(user.getName())
                                .role(user.getRole().name())
                                .build()
                )
                .toList();
    }

    private boolean isWorkerEligibleForDepartment(
            String email,
            Department department
    ) {

        if (email == null || department == null) {
            return false;
        }

        String normalized =
                email.toLowerCase();

        return switch (department) {

            case ROAD_MAINTENANCE,
                 PUBLIC_WORKS,
                 URBAN_INFRASTRUCTURE ->

                    normalized.contains("worker1") ||
                    normalized.contains("road");

            case WATER_SUPPLY,
                 DRAINAGE_DEPARTMENT,
                 SEWAGE_DEPARTMENT ->

                    normalized.contains("water");

            case ELECTRICAL_DEPARTMENT,
                 STREETLIGHT_MAINTENANCE ->

                    normalized.contains("streetlight");

            case WASTE_MANAGEMENT,
                 SANITATION_DEPARTMENT ->

                    normalized.contains("garbage");
        };
    }
}
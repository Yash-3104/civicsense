package com.civicsense.backend.service;

import com.civicsense.backend.dto.CreateStaffRequest;
import com.civicsense.backend.dto.StaffResponse;
import com.civicsense.backend.dto.UpdateStaffDepartmentsRequest;
import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.entity.WorkerDepartment;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.repository.WorkerDepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StaffService {

    private final UserRepository userRepository;
    private final WorkerDepartmentRepository workerDepartmentRepository;
    private final PasswordEncoder passwordEncoder;

    public List<StaffResponse> getStaff() {
        return userRepository.findByRoleIn(
                        List.of(UserRole.WORKER, UserRole.OFFICER, UserRole.SUPERVISOR)
                )
                .stream()
                .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::mapToStaffResponse)
                .toList();
    }

    public StaffResponse getStaffById(UUID staffId) {
        return mapToStaffResponse(getStaffOrThrow(staffId));
    }

    @Transactional
    public StaffResponse createStaff(CreateStaffRequest request) {
        if (request == null) {
            throw new RuntimeException("Staff request is required");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        UserRole role = request.getRole() == null ? UserRole.WORKER : request.getRole();
        validateStaffRole(role);

        User staff = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(role)
                .isVerified(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        User savedStaff = userRepository.save(staff);
        saveDepartmentMappings(savedStaff, request.getDepartments());

        return mapToStaffResponse(savedStaff);
    }

    @Transactional
    public StaffResponse replaceStaffDepartments(
            UUID staffId,
            UpdateStaffDepartmentsRequest request
    ) {
        User staff = getStaffOrThrow(staffId);

        workerDepartmentRepository
                .findByWorkerId(staff.getId())
                .forEach(workerDepartmentRepository::delete);

        List<Department> departments = request == null ? List.of() : request.getDepartments();
        saveDepartmentMappings(staff, departments);

        return mapToStaffResponse(staff);
    }

    @Transactional
    public StaffResponse addDepartment(UUID staffId, Department department) {
        User staff = getStaffOrThrow(staffId);

        if (department == null) {
            throw new RuntimeException("Department is required");
        }

        if (!workerDepartmentRepository.existsByWorkerAndDepartment(staff, department)) {
            WorkerDepartment workerDepartment = WorkerDepartment.builder()
                    .worker(staff)
                    .department(department)
                    .createdAt(LocalDateTime.now())
                    .build();

            workerDepartmentRepository.save(workerDepartment);
        }

        return mapToStaffResponse(staff);
    }

    @Transactional
    public StaffResponse removeDepartment(UUID staffId, Department department) {
        User staff = getStaffOrThrow(staffId);

        if (department == null) {
            throw new RuntimeException("Department is required");
        }

        workerDepartmentRepository.deleteByWorkerIdAndDepartment(staff.getId(), department);

        return mapToStaffResponse(staff);
    }

    private void saveDepartmentMappings(User staff, List<Department> departments) {
        if (staff == null || departments == null || departments.isEmpty()) {
            return;
        }

        departments.stream()
                .filter(department -> department != null)
                .distinct()
                .forEach(department -> {
                    if (!workerDepartmentRepository.existsByWorkerAndDepartment(staff, department)) {
                        WorkerDepartment workerDepartment = WorkerDepartment.builder()
                                .worker(staff)
                                .department(department)
                                .createdAt(LocalDateTime.now())
                                .build();

                        workerDepartmentRepository.save(workerDepartment);
                    }
                });
    }

    private User getStaffOrThrow(UUID staffId) {
        if (staffId == null) {
            throw new RuntimeException("Staff ID is required");
        }

        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new RuntimeException("Staff member not found"));

        validateStaffRole(staff.getRole());

        return staff;
    }

    private void validateStaffRole(UserRole role) {
        if (role != UserRole.WORKER &&
                role != UserRole.OFFICER &&
                role != UserRole.SUPERVISOR) {
            throw new RuntimeException(
                    "Only WORKER, OFFICER, or SUPERVISOR staff can be managed here"
            );
        }
    }

    private StaffResponse mapToStaffResponse(User staff) {
        List<String> departments = workerDepartmentRepository
                .findByWorkerId(staff.getId())
                .stream()
                .map(workerDepartment -> workerDepartment.getDepartment().name())
                .sorted()
                .toList();

        return StaffResponse.builder()
                .id(staff.getId())
                .name(staff.getName())
                .email(staff.getEmail())
                .phone(staff.getPhone())
                .role(staff.getRole().name())
                .isVerified(staff.getIsVerified())
                .departments(departments)
                .createdAt(staff.getCreatedAt())
                .updatedAt(staff.getUpdatedAt())
                .build();
    }
}

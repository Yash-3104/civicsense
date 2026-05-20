package com.civicsense.backend.repository;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.WorkerDepartment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkerDepartmentRepository extends JpaRepository<WorkerDepartment, UUID> {

    List<WorkerDepartment> findByWorkerId(UUID workerId);

    List<WorkerDepartment> findByDepartment(Department department);

    boolean existsByWorkerAndDepartment(User worker, Department department);

    boolean existsByWorkerIdAndDepartment(UUID workerId, Department department);

    Optional<WorkerDepartment> findByWorkerIdAndDepartment(UUID workerId, Department department);

    void deleteByWorkerIdAndDepartment(UUID workerId, Department department);
}


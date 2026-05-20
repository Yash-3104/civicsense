package com.civicsense.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "worker_departments",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_worker_department",
                        columnNames = {"worker_id", "department"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkerDepartment {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private Department department;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}

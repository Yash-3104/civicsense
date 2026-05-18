package com.civicsense.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "issues")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Issue {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String title;

    private String description;

    @Enumerated(EnumType.STRING)
    private IssueCategory category;

    @Enumerated(EnumType.STRING)
    private IssueStatus status;

    @Enumerated(EnumType.STRING)
    private SeverityLevel severity;

    @Column(name = "priority_score")
    private Double priorityScore;

    private Double latitude;

    private Double longitude;

    private String address;

    @ManyToOne
    @JoinColumn(name = "reported_by")
    private User reportedBy;

    @ManyToOne
    @JoinColumn(name = "assigned_to")
    private User assignedTo;

    @Enumerated(EnumType.STRING)
    @Column(name = "assigned_department")
    private Department assignedDepartment;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "sla_deadline")
    private LocalDateTime slaDeadline;

    @Builder.Default
    @Column(name = "sla_breached")
    private Boolean slaBreached = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "escalation_reason")
    private EscalationReason escalationReason;

    @Column(name = "escalation_notes", columnDefinition = "TEXT")
    private String escalationNotes;

    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @ManyToOne
    @JoinColumn(name = "escalated_by")
    private User escalatedBy;

    @Column(name = "escalation_level")
    private String escalationLevel;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "issue", cascade = CascadeType.ALL)
    private List<IssueMedia> media;

    @Column(columnDefinition = "TEXT")
    private String aiDescription;

    @Column(name = "ai_confidence_score")
    private Double aiConfidenceScore;

    @Column(name = "fake_report_likelihood")
    private Double fakeReportLikelihood;

    @Column(name = "severity_confidence")
    private Double severityConfidence;

    @Column(name = "duplicate_likelihood")
    private Double duplicateLikelihood;

    @Column(name = "ai_reasoning", columnDefinition = "TEXT")
    private String aiReasoning;

    @Column(name = "possible_duplicate_issue_id")
    private UUID possibleDuplicateIssueId;

    @Column(name = "ai_raw_caption", columnDefinition = "TEXT")
    private String aiRawCaption;

    @Column(name = "ai_clip_label")
    private String aiClipLabel;

    @Column(columnDefinition = "TEXT")
    private String resolutionNotes;

    private String resolutionImageUrl;

    private LocalDateTime resolvedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "rejection_reason")
    private RejectionReason rejectionReason;

    @Column(name = "rejection_notes", columnDefinition = "TEXT")
    private String rejectionNotes;

    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;
}

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

}
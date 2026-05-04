package com.civicsense.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "issue_media")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueMedia {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "issue_id")
    private Issue issue;

    private String mediaUrl;

    @Enumerated(EnumType.STRING)
   @Column(name = "media_type", nullable = false)
   private MediaType mediaType; 
}
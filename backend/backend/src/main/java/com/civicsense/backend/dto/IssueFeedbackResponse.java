package com.civicsense.backend.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueFeedbackResponse {

    private UUID id;

    private UUID issueId;

    private UUID citizenId;

    private String citizenName;

    private String rating;

    private String ratingLabel;

    private String comment;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

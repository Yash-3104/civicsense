package com.civicsense.backend.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponse {

    private UUID id;

    private UUID issueId;

    private String type;

    private String title;

    private String message;

    private String actionUrl;

    private boolean read;

    private LocalDateTime readAt;

    private LocalDateTime createdAt;
}

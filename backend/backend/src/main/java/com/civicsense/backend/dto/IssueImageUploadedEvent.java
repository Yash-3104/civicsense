package com.civicsense.backend.dto;

import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueImageUploadedEvent {
    private UUID issueId;
    private String filePath;
    private String fileName;
}
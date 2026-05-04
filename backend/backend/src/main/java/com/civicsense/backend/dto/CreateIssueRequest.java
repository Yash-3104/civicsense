package com.civicsense.backend.dto;

import com.civicsense.backend.entity.*;
import lombok.Data;

@Data
public class CreateIssueRequest {

    private String title;
    private String description;

    private IssueCategory category;
    private SeverityLevel severity;

    private Double latitude;
    private Double longitude;

    private String address;
}
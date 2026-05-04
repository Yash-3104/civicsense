package com.civicsense.backend.dto;

import com.civicsense.backend.entity.IssueCategory;
import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.SeverityLevel;
import lombok.Data;

@Data
public class IssueFilterRequest {

    private IssueCategory category;
    private SeverityLevel severity;
    private IssueStatus status;
}
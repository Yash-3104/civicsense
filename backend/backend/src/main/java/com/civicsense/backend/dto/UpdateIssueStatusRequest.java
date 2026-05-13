package com.civicsense.backend.dto;

import com.civicsense.backend.entity.IssueStatus;
import lombok.Data;

@Data
public class UpdateIssueStatusRequest {

    private IssueStatus status;
}
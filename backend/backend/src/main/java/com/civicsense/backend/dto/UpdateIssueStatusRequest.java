package com.civicsense.backend.dto;

import com.civicsense.backend.entity.IssueStatus;
import com.civicsense.backend.entity.RejectionReason;
import lombok.Data;

@Data
public class UpdateIssueStatusRequest {

    private IssueStatus status;

    private RejectionReason rejectionReason;

    private String rejectionNotes;
}
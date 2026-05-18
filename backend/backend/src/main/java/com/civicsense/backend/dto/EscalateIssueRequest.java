package com.civicsense.backend.dto;

import com.civicsense.backend.entity.EscalationReason;
import lombok.Data;

@Data
public class EscalateIssueRequest {
    private EscalationReason reason;
    private String notes;
    private String escalationLevel;
}

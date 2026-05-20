package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PublicBreakdownItem {
    private String label;
    private Long count;
    private Double percentage;
}

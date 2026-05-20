package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class StaffResponse {
    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String role;
    private Boolean isVerified;
    private List<String> departments;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

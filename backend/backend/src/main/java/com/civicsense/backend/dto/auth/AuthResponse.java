package com.civicsense.backend.dto.auth;

import com.civicsense.backend.entity.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType;
    private String userId;
    private String name;
    private String email;
    private UserRole role;
}
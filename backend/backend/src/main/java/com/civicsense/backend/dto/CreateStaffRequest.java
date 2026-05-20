package com.civicsense.backend.dto;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.List;

@Data
public class CreateStaffRequest {
    @NotBlank
    private String name;

    @Email
    @NotBlank
    private String email;

    private String phone;

    @NotBlank
    @Size(min = 6)
    private String password;

    private UserRole role;

    private List<Department> departments;
}

package com.civicsense.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SupervisorNoteRequest {

    @NotBlank
    @Size(max = 1000)
    private String note;
}

package com.civicsense.backend.dto;

import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DuplicateCheckRequest {

    private String sourceText;

    private List<String> candidateTexts;
}
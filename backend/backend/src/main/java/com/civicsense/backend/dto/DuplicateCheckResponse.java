package com.civicsense.backend.dto;

import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DuplicateCheckResponse {

    private List<Double> scores;
}
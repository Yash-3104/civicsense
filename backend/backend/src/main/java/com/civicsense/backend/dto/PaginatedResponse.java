package com.civicsense.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PaginatedResponse<T> {

    private List<T> data;

    private int page;
    private int size;

    private long total;
    private int totalPages;
}
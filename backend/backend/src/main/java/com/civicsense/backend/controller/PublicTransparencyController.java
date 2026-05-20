package com.civicsense.backend.controller;

import com.civicsense.backend.dto.PublicTransparencyResponse;
import com.civicsense.backend.service.PublicTransparencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicTransparencyController {

    private final PublicTransparencyService publicTransparencyService;

    @GetMapping("/transparency")
    public PublicTransparencyResponse getTransparencyOverview() {
        return publicTransparencyService.getTransparencyOverview();
    }
}

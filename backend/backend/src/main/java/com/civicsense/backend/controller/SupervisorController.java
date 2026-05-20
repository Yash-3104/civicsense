package com.civicsense.backend.controller;

import com.civicsense.backend.dto.SupervisorNoteRequest;
import com.civicsense.backend.dto.SupervisorOverviewResponse;
import com.civicsense.backend.service.SupervisorService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/supervisor")
@RequiredArgsConstructor
public class SupervisorController {

    private final SupervisorService supervisorService;

    @GetMapping("/overview")
    public SupervisorOverviewResponse getOverview() {
        return supervisorService.getOverview();
    }

    @PostMapping("/issues/{issueId}/note")
    public ResponseEntity<Void> addSupervisorNote(
            @PathVariable UUID issueId,
            @Valid @RequestBody SupervisorNoteRequest request
    ) {
        supervisorService.addSupervisorNote(issueId, request);

        return ResponseEntity.ok().build();
    }
}

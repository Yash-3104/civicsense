package com.civicsense.backend.controller;

import com.civicsense.backend.dto.IssueFeedbackRequest;
import com.civicsense.backend.dto.IssueFeedbackResponse;
import com.civicsense.backend.service.IssueFeedbackService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class IssueFeedbackController {

    private final IssueFeedbackService issueFeedbackService;

    @PostMapping("/api/citizen/my-reports/{issueId}/feedback")
    public IssueFeedbackResponse submitCitizenFeedback(
            @PathVariable UUID issueId,
            @RequestBody IssueFeedbackRequest request
    ) {
        return issueFeedbackService.submitCitizenFeedback(issueId, request);
    }

    @GetMapping("/api/citizen/my-reports/{issueId}/feedback")
    public IssueFeedbackResponse getCitizenFeedback(
            @PathVariable UUID issueId
    ) {
        return issueFeedbackService.getIssueFeedback(issueId);
    }

    @GetMapping("/api/issues/{issueId}/feedback")
    public IssueFeedbackResponse getIssueFeedback(
            @PathVariable UUID issueId
    ) {
        return issueFeedbackService.getIssueFeedback(issueId);
    }
}

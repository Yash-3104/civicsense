package com.civicsense.backend.dto;

import com.civicsense.backend.entity.IssueFeedbackRating;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class IssueFeedbackRequest {

    private IssueFeedbackRating rating;

    private String comment;
}

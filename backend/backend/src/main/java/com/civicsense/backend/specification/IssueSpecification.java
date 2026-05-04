package com.civicsense.backend.specification;

import com.civicsense.backend.dto.IssueFilterRequest;
import com.civicsense.backend.entity.*;
import org.springframework.data.jpa.domain.Specification;

public class IssueSpecification {

    public static Specification<Issue> filter(IssueFilterRequest request) {
        return (root, query, cb) -> {

            var predicates = cb.conjunction();

            if (request.getCategory() != null) {
                predicates = cb.and(predicates,
                        cb.equal(root.get("category"), request.getCategory()));
            }

            if (request.getSeverity() != null) {
                predicates = cb.and(predicates,
                        cb.equal(root.get("severity"), request.getSeverity()));
            }

            if (request.getStatus() != null) {
                predicates = cb.and(predicates,
                        cb.equal(root.get("status"), request.getStatus()));
            }

            return predicates;
        };
    }
}
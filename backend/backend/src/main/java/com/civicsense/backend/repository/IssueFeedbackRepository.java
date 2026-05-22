package com.civicsense.backend.repository;

import com.civicsense.backend.entity.IssueFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IssueFeedbackRepository extends JpaRepository<IssueFeedback, UUID> {

    Optional<IssueFeedback> findByIssueId(UUID issueId);

    boolean existsByIssueId(UUID issueId);
}

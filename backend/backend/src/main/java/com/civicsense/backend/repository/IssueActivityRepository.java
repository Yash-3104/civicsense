package com.civicsense.backend.repository;

import com.civicsense.backend.entity.IssueActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IssueActivityRepository extends JpaRepository<IssueActivity, UUID> {

    List<IssueActivity> findByIssueIdOrderByCreatedAtAsc(UUID issueId);
}

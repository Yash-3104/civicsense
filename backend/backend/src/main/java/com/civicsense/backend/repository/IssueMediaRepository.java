package com.civicsense.backend.repository;

import com.civicsense.backend.entity.IssueMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface IssueMediaRepository extends JpaRepository<IssueMedia, UUID> {
}
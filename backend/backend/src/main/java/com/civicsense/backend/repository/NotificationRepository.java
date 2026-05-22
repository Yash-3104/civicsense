package com.civicsense.backend.repository;

import com.civicsense.backend.entity.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<AppNotification, UUID> {

    List<AppNotification> findTop20ByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    Optional<AppNotification> findByIdAndRecipientId(UUID id, UUID recipientId);

    List<AppNotification> findByRecipientIdAndReadAtIsNull(UUID recipientId);

    List<AppNotification> findByRecipientIdAndReadAtIsNotNull(UUID recipientId);
}

package com.civicsense.backend.controller;

import com.civicsense.backend.dto.NotificationResponse;
import com.civicsense.backend.service.NotificationService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public List<NotificationResponse> getMyNotifications() {
        return notificationService.getMyNotifications();
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getMyUnreadCount() {
        return Map.of("count", notificationService.getMyUnreadCount());
    }

    @PatchMapping("/{notificationId}/read")
    public NotificationResponse markAsRead(@PathVariable UUID notificationId) {
        return notificationService.markAsRead(notificationId);
    }

    @PatchMapping("/read-all")
    public Map<String, Boolean> markAllAsRead() {
        notificationService.markAllAsRead();
        return Map.of("success", true);
    }

    @PatchMapping("/clear-read")
    public Map<String, Object> clearReadNotifications() {
        long deletedCount = notificationService.clearReadNotifications();

        return Map.of(
                "success", true,
                "deletedCount", deletedCount
        );
    }
}

package com.civicsense.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@Profile("prod")
public class ProductionConfigValidator {

    private static final Set<String> DEV_JWT_PLACEHOLDERS = Set.of(
            "civicsense_dev_secret_change_before_production_please_123456789",
            "change-this-before-production-use-a-long-random-secret"
    );

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${app.public-base-url:}")
    private String publicBaseUrl;

    @Value("${app.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @PostConstruct
    public void validateProductionConfig() {
        if (isBlank(jwtSecret)) {
            throw new IllegalStateException("Production config error: JWT_SECRET is required and cannot be blank.");
        }

        if (DEV_JWT_PLACEHOLDERS.contains(jwtSecret.trim())) {
            throw new IllegalStateException("Production config error: JWT_SECRET is using a known development placeholder.");
        }

        if (isBlank(publicBaseUrl)) {
            throw new IllegalStateException("Production config error: PUBLIC_BASE_URL is required and cannot be blank.");
        }

        if (isBlank(corsAllowedOrigins)) {
            throw new IllegalStateException("Production config error: CORS_ALLOWED_ORIGINS is required and cannot be blank.");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

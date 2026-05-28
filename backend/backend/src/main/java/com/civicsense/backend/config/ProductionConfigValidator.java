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
            "change-this-before-production-use-a-long-random-secret",
            "replace-with-long-random-jwt-secret"
    );

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${app.public-base-url:}")
    private String publicBaseUrl;

    @Value("${app.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @Value("${app.storage.provider:local}")
    private String storageProvider;

    @Value("${cloudinary.cloud-name:}")
    private String cloudinaryCloudName;

    @Value("${cloudinary.api-key:}")
    private String cloudinaryApiKey;

    @Value("${cloudinary.api-secret:}")
    private String cloudinaryApiSecret;

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

        if ("cloudinary".equalsIgnoreCase(storageProvider)) {
            if (isBlank(cloudinaryCloudName)) {
                throw new IllegalStateException("Production config error: CLOUDINARY_CLOUD_NAME is required when STORAGE_PROVIDER=cloudinary.");
            }

            if (isBlank(cloudinaryApiKey)) {
                throw new IllegalStateException("Production config error: CLOUDINARY_API_KEY is required when STORAGE_PROVIDER=cloudinary.");
            }

            if (isBlank(cloudinaryApiSecret)) {
                throw new IllegalStateException("Production config error: CLOUDINARY_API_SECRET is required when STORAGE_PROVIDER=cloudinary.");
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

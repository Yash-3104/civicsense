package com.civicsense.backend.config;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${cloudinary.api-key:}")
    private String apiKey;

    @Value("${cloudinary.api-secret:}")
    private String apiSecret;

    @Value("${app.storage.provider:local}")
    private String storageProvider;

    @Bean
    public Cloudinary cloudinary() {
        if (isCloudinaryProvider() && hasMissingCredentials()) {
            throw new IllegalStateException(
                    "Cloudinary storage requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
            );
        }

        return new Cloudinary(
                ObjectUtils.asMap(
                        "cloud_name", cloudName,
                        "api_key", apiKey,
                        "api_secret", apiSecret,
                        "secure", true
                )
        );
    }

    private boolean isCloudinaryProvider() {
        return "cloudinary".equalsIgnoreCase(storageProvider);
    }

    private boolean hasMissingCredentials() {
        return isBlank(cloudName) || isBlank(apiKey) || isBlank(apiSecret);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

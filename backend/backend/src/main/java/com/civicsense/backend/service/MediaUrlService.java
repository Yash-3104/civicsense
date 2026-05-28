package com.civicsense.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class MediaUrlService {

    @Value("${app.public-base-url:http://localhost:8031}")
    private String publicBaseUrl;

    public String resolveUploadUrl(String fileNameOrPath) {
        if (fileNameOrPath == null || fileNameOrPath.isBlank()) {
            return null;
        }

        String value = fileNameOrPath.trim();

        if (isRemoteUrl(value)) {
            return value;
        }

        String normalizedBase = publicBaseUrl.replaceAll("/+$", "");

        if (value.startsWith("/uploads/")) {
            return normalizedBase + value;
        }

        if (value.startsWith("uploads/")) {
            return normalizedBase + "/" + value;
        }

        return normalizedBase + "/uploads/" + value;
    }

    public boolean isRemoteUrl(String value) {
        if (value == null) {
            return false;
        }

        return value.startsWith("http://") || value.startsWith("https://");
    }
}

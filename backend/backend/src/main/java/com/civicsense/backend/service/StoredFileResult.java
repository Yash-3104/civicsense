package com.civicsense.backend.service;

import java.nio.file.Path;

public record StoredFileResult(
        String publicUrl,
        String storageKey,
        String originalFilename,
        Path localPath,
        String provider
) {}

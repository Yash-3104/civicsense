package com.civicsense.backend.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileStorageService {

    private static final String LOCAL_PROVIDER = "local";
    private static final String CLOUDINARY_PROVIDER = "cloudinary";

    private final Cloudinary cloudinary;
    private final MediaUrlService mediaUrlService;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Value("${app.storage.provider:local}")
    private String storageProvider;

    @Value("${app.cloudinary.folder:civicsense}")
    private String cloudinaryFolder;

    public Path storeFile(MultipartFile file) {
        return storeLocalFile(file, Paths.get(uploadDir))
                .toAbsolutePath()
                .normalize();
    }

    public StoredFileResult storeFileAndReturnResult(
            MultipartFile file,
            String folderHint
    ) {
        String provider = normalizeProvider(storageProvider);

        if (LOCAL_PROVIDER.equals(provider)) {
            Path savedPath = storeLocalFile(file, Paths.get(uploadDir));
            String fileName = savedPath.getFileName().toString();

            log.info("Stored image using provider={} folder={}", provider, folderHint);

            return new StoredFileResult(
                    mediaUrlService.resolveUploadUrl(fileName),
                    fileName,
                    file.getOriginalFilename(),
                    savedPath,
                    provider
            );
        }

        if (CLOUDINARY_PROVIDER.equals(provider)) {
            return storeCloudinaryFile(file, folderHint);
        }

        throw new IllegalStateException(
                "Unsupported storage provider: " + storageProvider
        );
    }

    private StoredFileResult storeCloudinaryFile(
            MultipartFile file,
            String folderHint
    ) {
        String provider = CLOUDINARY_PROVIDER;
        Path tempPath = storeLocalFile(
                file,
                Paths.get(uploadDir, "cloudinary-temp")
        );

        try {
            String folder = buildCloudinaryFolder(folderHint);
            File uploadFile = tempPath.toFile();
            String generatedFileName = tempPath.getFileName().toString();
            String publicId = stripExtension(generatedFileName);

            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult =
                    cloudinary.uploader().upload(
                            uploadFile,
                            ObjectUtils.asMap(
                                    "resource_type", "image",
                                    "folder", folder,
                                    "public_id", publicId,
                                    "use_filename", false,
                                    "unique_filename", false
                            )
                    );

            String secureUrl = asString(uploadResult.get("secure_url"));
            String storedPublicId = asString(uploadResult.get("public_id"));

            if (isBlank(secureUrl) || isBlank(storedPublicId)) {
                throw new IllegalStateException(
                        "Cloudinary upload did not return secure_url/public_id."
                );
            }

            log.info("Stored image using provider={} folder={}", provider, folder);

            // TODO: After AI pipeline accepts remote URLs, temp file cleanup can be added.
            return new StoredFileResult(
                    secureUrl,
                    storedPublicId,
                    file.getOriginalFilename(),
                    tempPath,
                    provider
            );

        } catch (Exception e) {
            log.error(
                    "Cloudinary upload failed for folderHint={}",
                    folderHint,
                    e
            );
            throw new RuntimeException("Cloudinary image upload failed", e);
        }
    }

    private Path storeLocalFile(
            MultipartFile file,
            Path targetDirectory
    ) {
        validateFile(file);

        try {
            Path uploadPath = targetDirectory
                    .toAbsolutePath()
                    .normalize();

            Files.createDirectories(uploadPath);

            String fileName = buildSafeFileName(file);
            Path filePath = uploadPath.resolve(fileName).normalize();

            if (!filePath.startsWith(uploadPath)) {
                throw new IllegalArgumentException("Invalid upload filename");
            }

            Files.copy(
                    file.getInputStream(),
                    filePath,
                    StandardCopyOption.REPLACE_EXISTING
            );

            return filePath;

        } catch (IOException e) {
            log.error("Local file upload failed", e);
            throw new RuntimeException("File upload failed", e);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }

        String contentType = file.getContentType();

        if (!isAllowedImageContentType(contentType)) {
            throw new IllegalArgumentException("Only image uploads are supported");
        }
    }

    private boolean isAllowedImageContentType(String contentType) {
        if (isBlank(contentType)) {
            return false;
        }

        return switch (contentType.trim().toLowerCase(Locale.ROOT)) {
            case "image/jpeg",
                    "image/jpg",
                    "image/png",
                    "image/gif",
                    "image/webp",
                    "image/bmp",
                    "image/tiff",
                    "image/heic",
                    "image/heif" -> true;
            default -> false;
        };
    }

    private String buildSafeFileName(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        String baseName = sanitizeBaseName(originalFilename);
        String extension = extractExtension(originalFilename);

        if (extension.isBlank()) {
            extension = inferExtension(file.getContentType());
        }

        return UUID.randomUUID() + "_" + baseName + extension;
    }

    private String sanitizeBaseName(String originalFilename) {
        if (isBlank(originalFilename)) {
            return "image";
        }

        String safeName = originalFilename.trim()
                .replace("\\", "/");

        int pathSeparatorIndex = safeName.lastIndexOf('/');

        if (pathSeparatorIndex >= 0) {
            safeName = safeName.substring(pathSeparatorIndex + 1);
        }

        int extensionIndex = safeName.lastIndexOf('.');

        if (extensionIndex > 0) {
            safeName = safeName.substring(0, extensionIndex);
        }

        String cleaned = safeName.trim()
                .replaceAll("\\s+", "-")
                .replaceAll("[^A-Za-z0-9_-]", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");

        return cleaned.isBlank() ? "image" : cleaned;
    }

    private String extractExtension(String originalFilename) {
        if (isBlank(originalFilename)) {
            return "";
        }

        String safeName = originalFilename.trim()
                .replace("\\", "/");

        int pathSeparatorIndex = safeName.lastIndexOf('/');

        if (pathSeparatorIndex >= 0) {
            safeName = safeName.substring(pathSeparatorIndex + 1);
        }

        int extensionIndex = safeName.lastIndexOf('.');

        if (
                extensionIndex < 0 ||
                        extensionIndex == safeName.length() - 1
        ) {
            return "";
        }

        String extension = safeName.substring(extensionIndex)
                .toLowerCase(Locale.ROOT);

        if (!extension.matches("\\.[a-z0-9]{1,12}")) {
            return "";
        }

        return extension;
    }

    private String inferExtension(String contentType) {
        if (isBlank(contentType)) {
            return "";
        }

        return switch (contentType.trim().toLowerCase(Locale.ROOT)) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/bmp" -> ".bmp";
            case "image/tiff" -> ".tiff";
            case "image/heic" -> ".heic";
            case "image/heif" -> ".heif";
            default -> "";
        };
    }

    private String stripExtension(String fileName) {
        if (isBlank(fileName)) {
            return "";
        }

        int extensionIndex = fileName.lastIndexOf('.');

        if (extensionIndex <= 0) {
            return fileName;
        }

        return fileName.substring(0, extensionIndex);
    }

    private String buildCloudinaryFolder(String folderHint) {
        String root = normalizeFolderPart(cloudinaryFolder, "civicsense");
        String child = normalizeFolderPart(folderHint, "uploads");

        return root + "/" + child;
    }

    private String normalizeFolderPart(
            String value,
            String fallback
    ) {
        if (isBlank(value)) {
            return fallback;
        }

        String cleaned = value.trim()
                .replace("\\", "/")
                .replaceAll("^/+", "")
                .replaceAll("/+$", "")
                .replaceAll("[^A-Za-z0-9_./-]", "-")
                .replaceAll("/{2,}", "/");

        return cleaned.isBlank() ? fallback : cleaned;
    }

    private String normalizeProvider(String provider) {
        if (isBlank(provider)) {
            return LOCAL_PROVIDER;
        }

        return provider.trim().toLowerCase(Locale.ROOT);
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

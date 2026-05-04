package com.civicsense.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    public String storeFile(MultipartFile file) {

        try {
            //  Normalize + absolute path (fixes WSL + relative issues)
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();

            //  Ensure directory exists
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            //  Generate unique filename
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();

            //  Resolve full path safely
            Path filePath = uploadPath.resolve(fileName);

            //  Copy file (safe + overwrite if exists)
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            return fileName;

        } catch (IOException e) {
            e.printStackTrace(); //  IMPORTANT for debugging
            throw new RuntimeException("File upload failed");
        }
    }
}
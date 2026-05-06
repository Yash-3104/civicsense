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

    public Path storeFile(MultipartFile file) {

        try {
    
            Path uploadPath = Paths.get(uploadDir)
                    .toAbsolutePath()
                    .normalize();
    
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
    
            String fileName =
                    UUID.randomUUID() + "_" + file.getOriginalFilename();
    
            Path filePath = uploadPath.resolve(fileName);
    
            Files.copy(
                    file.getInputStream(),
                    filePath,
                    StandardCopyOption.REPLACE_EXISTING
            );
    
            return filePath;
    
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException("File upload failed");
        }
    } 
}
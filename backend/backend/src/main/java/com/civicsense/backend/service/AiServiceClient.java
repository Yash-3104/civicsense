package com.civicsense.backend.service;

import com.civicsense.backend.dto.DuplicateCheckRequest;
import com.civicsense.backend.dto.DuplicateCheckResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiServiceClient {

    private final RestTemplate restTemplate;

    @Value("${app.ai-service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    // =====================================================
    // DIRECT FILE
    // =====================================================

    public Map<String, Object> analyzeImage(MultipartFile file) {
        String url = buildAiUrl("/analyze");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", file.getResource());

        HttpEntity<MultiValueMap<String, Object>> request =
                new HttpEntity<>(body, headers);

        try {
            log.debug("Sending direct image to AI service: {}", url);

            ResponseEntity<Map<String, Object>> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            request,
                            new ParameterizedTypeReference<Map<String, Object>>() {}
                    );

            log.debug("AI direct response: {}", response.getBody());

            return response.getBody();
        } catch (RestClientException exception) {
            throw new RuntimeException(
                    "AI image analysis failed. Check that the AI service is running at " +
                            getNormalizedBaseUrl() +
                            " and that /analyze is available.",
                    exception
            );
        }
    }

    // =====================================================
    // FILE PATH (ASYNC PIPELINE)
    // =====================================================

    public Map<String, Object> analyzeImageFromPath(String filePath) {
        String url = buildAiUrl("/analyze");

        File file = new File(filePath);

        if (!file.exists()) {
            throw new RuntimeException("AI image analysis failed. File not found: " + filePath);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        FileSystemResource fileResource = new FileSystemResource(file);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", fileResource);

        HttpEntity<MultiValueMap<String, Object>> request =
                new HttpEntity<>(body, headers);

        try {
            log.debug(
                    "Sending file to AI service: {} -> {}",
                    fileResource.getFilename(),
                    url
            );

            ResponseEntity<Map<String, Object>> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            request,
                            new ParameterizedTypeReference<Map<String, Object>>() {}
                    );

            log.debug("AI async response: {}", response.getBody());

            return response.getBody();
        } catch (RestClientException exception) {
            throw new RuntimeException(
                    "AI async image analysis failed. Check that the AI service is running at " +
                            getNormalizedBaseUrl() +
                            " and that /analyze is available.",
                    exception
            );
        }
    }

    public List<Double> checkDuplicateSimilarity(
            String sourceText,
            List<String> candidateTexts
    ) {
        if (candidateTexts == null || candidateTexts.isEmpty()) {
            return List.of();
        }

        String url = buildAiUrl("/duplicate-check");

        DuplicateCheckRequest requestBody =
                DuplicateCheckRequest.builder()
                        .sourceText(sourceText)
                        .candidateTexts(candidateTexts)
                        .build();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<DuplicateCheckRequest> request =
                new HttpEntity<>(requestBody, headers);

        try {
            log.debug("Sending duplicate check to AI service: {}", url);

            ResponseEntity<DuplicateCheckResponse> response =
                    restTemplate.postForEntity(
                            url,
                            request,
                            DuplicateCheckResponse.class
                    );

            if (
                    response.getBody() == null ||
                            response.getBody().getScores() == null
            ) {
                return List.of();
            }

            return response.getBody().getScores();
        } catch (RestClientException exception) {
            throw new RuntimeException(
                    "AI duplicate check failed. Check that the AI service is running at " +
                            getNormalizedBaseUrl() +
                            " and that /duplicate-check is available.",
                    exception
            );
        }
    }

    private String buildAiUrl(String path) {
        String normalizedBase = getNormalizedBaseUrl();

        if (path == null || path.isBlank()) {
            return normalizedBase;
        }

        String normalizedPath = path.startsWith("/") ? path : "/" + path;

        // Defensive guard:
        // AI_SERVICE_BASE_URL should be http://localhost:8000, not http://localhost:8000/analyze.
        // If someone accidentally sets it with an endpoint suffix, avoid /analyze/analyze.
        if (normalizedBase.endsWith(normalizedPath)) {
            return normalizedBase;
        }

        return normalizedBase + normalizedPath;
    }

    private String getNormalizedBaseUrl() {
        String value = aiServiceBaseUrl == null || aiServiceBaseUrl.isBlank()
                ? "http://localhost:8000"
                : aiServiceBaseUrl.trim();

        value = value.replaceAll("/+$", "");

        // Keep the property as a base URL.
        // If the value was accidentally set to a specific endpoint, normalize it back.
        if (value.endsWith("/analyze")) {
            return value.substring(0, value.length() - "/analyze".length());
        }

        if (value.endsWith("/duplicate-check")) {
            return value.substring(0, value.length() - "/duplicate-check".length());
        }

        return value;
    }
}

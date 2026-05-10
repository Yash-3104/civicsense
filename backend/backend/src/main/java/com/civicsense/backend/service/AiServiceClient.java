package com.civicsense.backend.service;

import lombok.RequiredArgsConstructor;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.civicsense.backend.dto.DuplicateCheckRequest;
import com.civicsense.backend.dto.DuplicateCheckResponse;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiServiceClient {

    private final RestTemplate restTemplate;

    // =====================================================
    // DIRECT FILE
    // =====================================================

    public Map<String, Object> analyzeImage(
            MultipartFile file
    ) {

        String url = "http://localhost:8000/analyze";

        HttpHeaders headers = new HttpHeaders();

        headers.setContentType(
                MediaType.MULTIPART_FORM_DATA
        );

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", file.getResource());

        HttpEntity<MultiValueMap<String, Object>> request =
                new HttpEntity<>(body, headers);

        ResponseEntity<Map<String, Object>> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        request,
                        new ParameterizedTypeReference<Map<String, Object>>() {}
                );

        System.out.println(
                "AI DIRECT RESPONSE: " +
                response.getBody()
        );

        return response.getBody();
    }

    // =====================================================
    // FILE PATH (ASYNC PIPELINE)
    // =====================================================

    public Map<String, Object> analyzeImageFromPath(
            String filePath
    ) {

        String url = "http://localhost:8000/analyze";

        HttpHeaders headers = new HttpHeaders();

        headers.setContentType(
                MediaType.MULTIPART_FORM_DATA
        );

        FileSystemResource fileResource =
                new FileSystemResource(filePath);

        System.out.println(
                "Sending file to AI service: " +
                fileResource.getFilename()
        );

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", fileResource);

        HttpEntity<MultiValueMap<String, Object>> request =
                new HttpEntity<>(body, headers);

        ResponseEntity<Map<String, Object>> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        request,
                        new ParameterizedTypeReference<Map<String, Object>>() {}
                );

        System.out.println(
                "AI ASYNC RESPONSE: " +
                response.getBody()
        );

        return response.getBody();
    }
    public List<Double> checkDuplicateSimilarity(
        String sourceText,
        List<String> candidateTexts
) {

    String url = "http://localhost:8000/duplicate-check";

    DuplicateCheckRequest requestBody =
            DuplicateCheckRequest.builder()
                    .sourceText(sourceText)
                    .candidateTexts(candidateTexts)
                    .build();

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<DuplicateCheckRequest> request =
            new HttpEntity<>(requestBody, headers);

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
}
}
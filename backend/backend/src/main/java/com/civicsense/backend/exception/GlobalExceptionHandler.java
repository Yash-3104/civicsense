package com.civicsense.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Validation failed",
                request.getRequestURI(),
                fieldErrors
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "INVALID_REQUEST_PARAMETERS",
                "Invalid request parameters",
                request.getRequestURI(),
                Map.of("details", exception.getMessage())
        );
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationException.class})
    public ResponseEntity<Map<String, Object>> handleAuthentication(
            Exception exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                "Invalid email or password",
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.FORBIDDEN,
                "ACCESS_DENIED",
                "You do not have permission to perform this action",
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(ForbiddenActionException.class)
    public ResponseEntity<Map<String, Object>> handleForbiddenAction(
            ForbiddenActionException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.FORBIDDEN,
                "FORBIDDEN_ACTION",
                exception.getMessage(),
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(
            ResourceNotFoundException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.NOT_FOUND,
                "RESOURCE_NOT_FOUND",
                exception.getMessage(),
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateEmail(
            EmailAlreadyRegisteredException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_REGISTERED",
                exception.getMessage(),
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(
            IllegalArgumentException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "BAD_REQUEST",
                exception.getMessage(),
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(
            RuntimeException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "REQUEST_FAILED",
                exception.getMessage(),
                request.getRequestURI(),
                null
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(
            Exception exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Something went wrong. Please try again.",
                request.getRequestURI(),
                null
        );
    }

    private ResponseEntity<Map<String, Object>> buildResponse(
            HttpStatus status,
            String code,
            String message,
            String path,
            Object errors
    ) {
        Map<String, Object> body = new LinkedHashMap<>();

        body.put("message", message);
        body.put("code", code);
        body.put("timestamp", Instant.now().toString());
        body.put("path", path);

        if (errors != null) {
            body.put("errors", errors);
        }

        return ResponseEntity.status(status).body(body);
    }
}

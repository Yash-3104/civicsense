package com.civicsense.backend.service;

import com.civicsense.backend.dto.auth.*;
import com.civicsense.backend.entity.User;
import com.civicsense.backend.entity.UserRole;
import com.civicsense.backend.exception.EmailAlreadyRegisteredException;
import com.civicsense.backend.repository.UserRepository;
import com.civicsense.backend.security.CustomUserDetails;
import com.civicsense.backend.security.JwtService;
import lombok.RequiredArgsConstructor;

import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException("Email already registered");
        }

        // Public registration must never trust role from client request.
        // Staff/admin/supervisor/worker accounts must be created through Staff Management.
        UserRole role = UserRole.CITIZEN;

        User user = User.builder()
                .name(request.getName() == null ? null : request.getName().trim())
                .email(email)
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(role)
                .isVerified(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        User savedUser = userRepository.save(user);

        CustomUserDetails userDetails = new CustomUserDetails(savedUser);
        String token = jwtService.generateToken(userDetails);

        return new AuthResponse(
                token,
                "Bearer",
                savedUser.getId().toString(),
                savedUser.getName(),
                savedUser.getEmail(),
                savedUser.getRole()
        );
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        email,
                        request.getPassword()
                )
        );

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String token = jwtService.generateToken(userDetails);

        return new AuthResponse(
                token,
                "Bearer",
                user.getId().toString(),
                user.getName(),
                user.getEmail(),
                user.getRole()
        );
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        return email.trim().toLowerCase();
    }
}

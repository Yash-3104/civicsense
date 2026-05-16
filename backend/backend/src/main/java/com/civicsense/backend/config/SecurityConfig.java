package com.civicsense.backend.config;

import com.civicsense.backend.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;

import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;

import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.core.userdetails.UserDetailsService;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http
                .cors(cors -> {})
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )
                .authorizeHttpRequests(auth -> auth

                        // CORS preflight must come BEFORE protected route matchers
                        .requestMatchers(
                                HttpMethod.OPTIONS,
                                "/**"
                        ).permitAll()

                        // Public endpoints
                        .requestMatchers(
                                "/api/auth/**",
                                "/test",
                                "/uploads/**",
                                "/ws/**"
                        ).permitAll()

                        // Admin routes
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMIN")

                        // Officer routes
                        .requestMatchers("/api/officer/**")
                        .hasAnyRole(
                                "OFFICER",
                                "ADMIN",
                                "SUPERVISOR"
                        )

                        // Citizen routes
                        .requestMatchers("/api/citizen/**")
                        .hasAnyRole(
                                "CITIZEN",
                                "OFFICER",
                                "ADMIN",
                                "WORKER",
                                "SUPERVISOR"
                        )

                        // Issue routes
                        .requestMatchers("/api/issues/**")
                        .hasAnyRole(
                                "CITIZEN",
                                "OFFICER",
                                "ADMIN",
                                "WORKER",
                                "SUPERVISOR"
                        )

                        // Worker listing / worker dashboard support
                        .requestMatchers("/api/workers/**")
                        .hasAnyRole(
                                "ADMIN",
                                "OFFICER",
                                "WORKER",
                                "SUPERVISOR"
                        )

                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {

        DaoAuthenticationProvider provider =
                new DaoAuthenticationProvider(userDetailsService);

        provider.setPasswordEncoder(passwordEncoder());

        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config
    ) throws Exception {
        return config.getAuthenticationManager();
    }
}
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
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> {})
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/public/**",
                                "/test",
                                "/uploads/**",
                                "/ws/**"
                        ).permitAll()

                        /*
                         * CSV exports.
                         * Admin export is already working.
                         * Supervisor export is moved to /api/export/supervisor/**
                         * to avoid the /api/supervisor/** matcher conflict causing 403.
                         */
                        .requestMatchers(HttpMethod.GET, "/api/admin/export/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/export/supervisor/**").authenticated()
                        .requestMatchers("/api/notifications/**").authenticated()

                        .requestMatchers("/api/departments", "/api/departments/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/staff", "/api/staff/**").hasRole("ADMIN")
                        .requestMatchers("/api/supervisor", "/api/supervisor/**").hasAnyRole("SUPERVISOR", "ADMIN")
                        .requestMatchers("/api/officer/**").hasAnyRole("OFFICER", "ADMIN", "SUPERVISOR")
                        .requestMatchers("/api/citizen/**").hasAnyRole("CITIZEN", "OFFICER", "ADMIN", "WORKER", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/workers/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/workers/**").hasRole("ADMIN")
                        .requestMatchers("/api/workers", "/api/workers/**").hasAnyRole("ADMIN", "OFFICER", "WORKER", "SUPERVISOR")
                        .requestMatchers("/api/issues/**").hasAnyRole("CITIZEN", "OFFICER", "ADMIN", "WORKER", "SUPERVISOR")
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}

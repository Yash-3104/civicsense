package com.civicsense.backend.controller;

import com.civicsense.backend.repository.UserRepository;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class TestController {

    private final UserRepository userRepository;

    @GetMapping("/users")
    public long getUsersCount() {
        return userRepository.count();
    }
}
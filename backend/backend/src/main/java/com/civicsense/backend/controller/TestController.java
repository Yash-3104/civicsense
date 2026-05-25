package com.civicsense.backend.controller;

import com.civicsense.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("dev")
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class TestController {

    private final UserRepository userRepository;

    @GetMapping("/users/count")
    public long getUsersCount() {
        return userRepository.count();
    }
}

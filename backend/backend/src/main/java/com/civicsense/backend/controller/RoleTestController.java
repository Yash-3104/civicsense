package com.civicsense.backend.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("dev")
@RequestMapping("/api/dev/role-test")
public class RoleTestController {

    @GetMapping("/citizen")
    public String citizen() {
        return "Citizen endpoint working";
    }

    @GetMapping("/officer")
    public String officer() {
        return "Officer endpoint working";
    }

    @GetMapping("/admin")
    public String admin() {
        return "Admin endpoint working";
    }
}

package com.civicsense.backend.controller;

import org.springframework.web.bind.annotation.*;

@RestController
public class RoleTestController {

    @GetMapping("/api/citizen/test")
    public String citizen() {
        return "Citizen endpoint working";
    }

    @GetMapping("/api/officer/test")
    public String officer() {
        return "Officer endpoint working";
    }

    @GetMapping("/api/admin/test")
    public String admin() {
        return "Admin endpoint working";
    }
}
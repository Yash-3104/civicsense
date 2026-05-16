package com.civicsense.backend.util;

import com.civicsense.backend.entity.Department;
import com.civicsense.backend.entity.IssueCategory;

import java.util.List;

public class DepartmentRouting {

    private DepartmentRouting() {}

    public static List<Department> getDepartmentsForCategory(
            IssueCategory category
    ) {

        if (category == null) {
            return List.of();
        }

        return switch (category) {

            case POTHOLE -> List.of(
                    Department.ROAD_MAINTENANCE,
                    Department.PUBLIC_WORKS,
                    Department.URBAN_INFRASTRUCTURE
            );

            case WATER_LEAK -> List.of(
                    Department.WATER_SUPPLY,
                    Department.DRAINAGE_DEPARTMENT,
                    Department.SEWAGE_DEPARTMENT
            );

            case GARBAGE -> List.of(
                    Department.WASTE_MANAGEMENT,
                    Department.SANITATION_DEPARTMENT
            );

            case STREETLIGHT -> List.of(
                    Department.ELECTRICAL_DEPARTMENT,
                    Department.STREETLIGHT_MAINTENANCE
            );
        };
    }
}
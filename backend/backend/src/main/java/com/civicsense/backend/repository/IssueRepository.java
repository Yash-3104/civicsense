package com.civicsense.backend.repository;

import com.civicsense.backend.entity.Issue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IssueRepository extends JpaRepository<Issue, UUID>,
        JpaSpecificationExecutor<Issue> {

    // ================= GEO QUERY =================
    @Query(value = """
        SELECT * FROM issues i
        WHERE (
            6371 * acos(
                cos(radians(:lat)) *
                cos(radians(i.latitude)) *
                cos(radians(i.longitude) - radians(:lng)) +
                sin(radians(:lat)) *
                sin(radians(i.latitude))
            )
        ) <= :radius
        """,
        nativeQuery = true)
    List<Issue> findNearbyIssues(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radius") double radius
    );
}
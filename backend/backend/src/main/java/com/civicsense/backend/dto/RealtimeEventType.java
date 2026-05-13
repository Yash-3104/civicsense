package com.civicsense.backend.dto;

public final class RealtimeEventType {

    private RealtimeEventType() {}

    public static final String NEW_ISSUE = "NEW_ISSUE";

    public static final String ISSUE_UPDATED = "ISSUE_UPDATED";

    public static final String ISSUE_DELETED = "ISSUE_DELETED";

    public static final String AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED";

    public static final String ISSUE_RESOLVED = "ISSUE_RESOLVED";
}
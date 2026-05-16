package com.civicsense.backend.dto;

public final class RealtimeEventType {

    private RealtimeEventType() {}

    public static final String NEW_ISSUE = "NEW_ISSUE";

    public static final String ISSUE_UPDATED = "ISSUE_UPDATED";

    public static final String ISSUE_DELETED = "ISSUE_DELETED";

    public static final String AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED";

    public static final String ISSUE_RESOLVED = "ISSUE_RESOLVED";

    public static final String ISSUE_ASSIGNED = "ISSUE_ASSIGNED";
   
    public static final String ISSUE_REJECTED = "ISSUE_REJECTED";

    public static final String ISSUE_PENDING_CLOSURE = "ISSUE_PENDING_CLOSURE";

}

package kg.teksherhub.monitor;

import java.time.Instant;

public record SourceMonitorChangeResponse(
        Long id, Long monitorId, Instant detectedAt,
        String previousHash, String currentHash,
        String previousContentType, String currentContentType,
        String previousContent, String currentContent,
        boolean comparisonAvailable, boolean previousContentTruncated, boolean currentContentTruncated,
        String status, Instant reviewedAt, String reviewedBy, String reviewNote
) {}

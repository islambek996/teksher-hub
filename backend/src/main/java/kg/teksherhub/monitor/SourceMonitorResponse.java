package kg.teksherhub.monitor;

import java.time.Instant;

public record SourceMonitorResponse(
        Long id, String name, String jurisdiction, String sourceUrl, boolean enabled, int intervalHours,
        Instant lastCheckedAt, Integer lastHttpStatus, Instant lastChangeDetectedAt, String lastError,
        String createdBy, Instant createdAt, Instant updatedAt
) {
    static SourceMonitorResponse from(SourceMonitor m) {
        return new SourceMonitorResponse(m.getId(), m.getName(), m.getJurisdiction(), m.getSourceUrl(),
                m.isEnabled(), m.getIntervalHours(), m.getLastCheckedAt(), m.getLastHttpStatus(),
                m.getLastChangeDetectedAt(), m.getLastError(), m.getCreatedBy(), m.getCreatedAt(), m.getUpdatedAt());
    }
}
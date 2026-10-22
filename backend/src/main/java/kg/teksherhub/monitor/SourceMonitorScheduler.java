package kg.teksherhub.monitor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SourceMonitorScheduler {
    private static final Logger log = LoggerFactory.getLogger(SourceMonitorScheduler.class);
    private final SourceMonitorService service;
    public SourceMonitorScheduler(SourceMonitorService service) { this.service = service; }

    @Scheduled(fixedDelayString = "${app.monitor.scheduler-delay-ms:900000}", initialDelayString = "${app.monitor.initial-delay-ms:60000}")
    public void checkDueSources() {
        try {
            int count = service.checkDue();
            if (count > 0) log.info("Checked {} official source monitor(s)", count);
        } catch (Exception ex) {
            log.error("Official source monitoring cycle failed: {}", ex.getMessage());
        }
    }
}
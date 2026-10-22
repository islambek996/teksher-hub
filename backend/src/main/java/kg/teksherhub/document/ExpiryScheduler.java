package kg.teksherhub.document;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(ExpiryScheduler.class);
    private final DocumentService service;
    public ExpiryScheduler(DocumentService service) { this.service = service; }

    @Scheduled(cron = "0 10 2 * * *")
    public void markExpired() {
        int count = service.markExpiredDocuments();
        if (count > 0) log.info("Marked {} documents as expired", count);
    }
}
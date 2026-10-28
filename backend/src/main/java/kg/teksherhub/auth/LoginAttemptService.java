package kg.teksherhub.auth;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Locale;

/**
 * Lightweight per-username login throttling.
 * State is intentionally process-local; use a shared store if the API is scaled to multiple instances.
 */
@Service
public class LoginAttemptService {
    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_USERS = 10_000;

    private final Map<String, AttemptState> attempts = new HashMap<>();

    public synchronized long secondsUntilAllowed(String username) {
        Instant now = Instant.now();
        pruneExpired(now);
        AttemptState state = attempts.get(normalize(username));
        if (state == null || state.lockedUntil == null || !state.lockedUntil.isAfter(now)) {
            if (state != null && state.lockedUntil != null) attempts.remove(normalize(username));
            return 0;
        }
        return Math.max(1, Duration.between(now, state.lockedUntil).toSeconds());
    }

    public synchronized long recordFailure(String username) {
        Instant now = Instant.now();
        String key = normalize(username);
        pruneExpired(now);
        AttemptState state = attempts.computeIfAbsent(key, ignored -> new AttemptState(now));
        if (state.lockedUntil != null && state.lockedUntil.isAfter(now)) {
            return Math.max(1, Duration.between(now, state.lockedUntil).toSeconds());
        }
        if (state.windowStartedAt.plus(WINDOW).isBefore(now)) {
            state.windowStartedAt = now;
            state.failures = 0;
        }
        state.failures++;
        if (state.failures >= MAX_FAILED_ATTEMPTS) {
            state.lockedUntil = now.plus(LOCK_DURATION);
            return LOCK_DURATION.toSeconds();
        }
        return 0;
    }

    public synchronized void recordSuccess(String username) {
        attempts.remove(normalize(username));
    }

    private void pruneExpired(Instant now) {
        Iterator<Map.Entry<String, AttemptState>> iterator = attempts.entrySet().iterator();
        while (iterator.hasNext()) {
            AttemptState state = iterator.next().getValue();
            boolean windowExpired = state.windowStartedAt.plus(WINDOW).isBefore(now);
            boolean lockExpired = state.lockedUntil == null || !state.lockedUntil.isAfter(now);
            if (windowExpired && lockExpired) iterator.remove();
        }
        if (attempts.size() > MAX_TRACKED_USERS) {
            Iterator<String> keys = attempts.keySet().iterator();
            while (attempts.size() > MAX_TRACKED_USERS && keys.hasNext()) {
                attempts.remove(keys.next());
            }
        }
    }

    private static String normalize(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static final class AttemptState {
        private Instant windowStartedAt;
        private int failures;
        private Instant lockedUntil;

        private AttemptState(Instant now) {
            this.windowStartedAt = now;
        }
    }
}

package kg.teksherhub.document;

public enum DocumentStatus {
    DRAFT, UNDER_REVIEW, ACTIVE, EXPIRED, ARCHIVED;

    public String label() {
        return switch (this) {
            case DRAFT -> "Черновик";
            case UNDER_REVIEW -> "На проверке";
            case ACTIVE -> "Действует";
            case EXPIRED -> "Срок действия истёк";
            case ARCHIVED -> "В архиве";
        };
    }
}
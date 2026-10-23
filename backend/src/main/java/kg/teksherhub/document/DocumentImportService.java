package kg.teksherhub.document;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DocumentImportService {
    private final DocumentService documents;
    private final Validator validator;

    public DocumentImportService(DocumentService documents, Validator validator) {
        this.documents = documents;
        this.validator = validator;
    }

    /**
     * Imports one row in its own transaction, so a bad row does not roll back
     * other valid rows in the same CSV batch. Imported statuses are never trusted.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DocumentResponse importOne(DocumentRequest request, String username, int rowNumber) {
        if (request == null) throw new IllegalArgumentException("Строка не содержит данных документа");

        DocumentRequest safe = new DocumentRequest(
                request.title(),
                request.jurisdiction(),
                request.kind(),
                request.area(),
                request.productGroup(),
                request.keywords(),
                List.of(),
                request.documentNumber(),
                request.documentDate(),
                request.effectiveFrom(),
                request.effectiveUntil(),
                request.sourceUrl(),
                request.description(),
                request.content(),
                "",
                "CSV импорт, строка " + rowNumber
        );

        Set<ConstraintViolation<DocumentRequest>> violations = validator.validate(safe);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new IllegalArgumentException(message);
        }

        return documents.create(safe, username);
    }
}

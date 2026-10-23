package kg.teksherhub.ai;

import kg.teksherhub.ai.AiSummaryService.SummaryRequest;
import kg.teksherhub.ai.AiSummaryService.SummaryResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ai")
public class AiSummaryController {
    private final AiSummaryService service;

    public AiSummaryController(AiSummaryService service) {
        this.service = service;
    }

    @PostMapping(value = "/summarize", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SummaryResponse summarize(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String jurisdiction,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String documentNumber,
            @RequestParam(required = false) String documentDate,
            @RequestParam(required = false) String effectiveFrom,
            @RequestParam(required = false) String effectiveUntil,
            @RequestParam(required = false) String sourceUrl,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) MultipartFile file) {
        return service.summarize(new SummaryRequest(title, jurisdiction, kind, area, documentNumber,
                documentDate, effectiveFrom, effectiveUntil, sourceUrl, content, language), file);
    }
}

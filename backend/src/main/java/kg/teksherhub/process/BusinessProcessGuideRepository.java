package kg.teksherhub.process;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BusinessProcessGuideRepository extends JpaRepository<BusinessProcessGuide, String> {
    List<BusinessProcessGuide> findAllByOrderByOrderIndexAscTitleAsc();
}

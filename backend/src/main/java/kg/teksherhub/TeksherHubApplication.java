package kg.teksherhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TeksherHubApplication {
    public static void main(String[] args) {
        SpringApplication.run(TeksherHubApplication.class, args);
    }
}
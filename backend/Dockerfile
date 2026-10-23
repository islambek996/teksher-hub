FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus tesseract-ocr-kir \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app
COPY --from=build /workspace/target/teksher-hub-api-1.0.0.jar /app/app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75.0","-jar","/app/app.jar"]
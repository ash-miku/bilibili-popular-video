FROM golang:1.25-local

WORKDIR /app
COPY bili-server .
COPY migrations/ ./migrations/
COPY bin/ffmpeg ./bin/ffmpeg
RUN chmod +x ./bili-server ./bin/ffmpeg

EXPOSE 8080
CMD ["./bili-server"]

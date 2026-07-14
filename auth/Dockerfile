FROM golang:1.26-alpine AS build
WORKDIR /src
RUN apk add --no-cache ca-certificates git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/auth ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/auth /auth
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/auth"]

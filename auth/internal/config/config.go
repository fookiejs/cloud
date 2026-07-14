package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
}

type Config struct {
	Addr               string
	PublicURL          string
	DatabaseURL        string
	GoogleClientID     string
	GoogleClientSecret string
	JWTPrivateKeyPEM   string
	JWTKeyID           string
	AccessTokenTTL     time.Duration
	RefreshTokenTTL    time.Duration
	AuthCodeTTL        time.Duration
	CookieDomain       string
	Clients            []Client
	AllowedOrigins     []string
	AdminEmails        []string
}

func Load() (Config, error) {
	cfg := Config{
		Addr:            envOr("ADDR", ":8080"),
		PublicURL:       strings.TrimRight(os.Getenv("PUBLIC_URL"), "/"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		GoogleClientID:  os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		JWTPrivateKeyPEM:   os.Getenv("JWT_PRIVATE_KEY"),
		JWTKeyID:           envOr("JWT_KEY_ID", "fookie-auth-1"),
		CookieDomain:       os.Getenv("COOKIE_DOMAIN"),
		AccessTokenTTL:     durationOr("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:    durationOr("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		AuthCodeTTL:        durationOr("AUTH_CODE_TTL", 5*time.Minute),
		AllowedOrigins:     splitCSV(os.Getenv("ALLOWED_ORIGINS")),
		AdminEmails:        splitCSV(os.Getenv("FOOKIE_ADMIN_EMAILS")),
	}

	if cfg.PublicURL == "" {
		return Config{}, fmt.Errorf("PUBLIC_URL is required")
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" {
		return Config{}, fmt.Errorf("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required")
	}
	if cfg.JWTPrivateKeyPEM == "" {
		return Config{}, fmt.Errorf("JWT_PRIVATE_KEY is required (PEM PKCS8 RSA private key)")
	}

	clientsRaw := os.Getenv("AUTH_CLIENTS_JSON")
	if clientsRaw == "" {
		return Config{}, fmt.Errorf("AUTH_CLIENTS_JSON is required")
	}
	if err := json.Unmarshal([]byte(clientsRaw), &cfg.Clients); err != nil {
		return Config{}, fmt.Errorf("parse AUTH_CLIENTS_JSON: %w", err)
	}
	if len(cfg.Clients) == 0 {
		return Config{}, fmt.Errorf("AUTH_CLIENTS_JSON must include at least one client")
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func durationOr(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	if d, err := time.ParseDuration(v); err == nil {
		return d
	}
	if sec, err := strconv.Atoi(v); err == nil {
		return time.Duration(sec) * time.Second
	}
	return fallback
}

func splitCSV(v string) []string {
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fookie/cloud/auth/internal/config"
	"github.com/fookie/cloud/auth/internal/db"
	"github.com/fookie/cloud/auth/internal/httpapi"
	"github.com/fookie/cloud/auth/internal/oauth"
	"github.com/fookie/cloud/auth/internal/token"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	store, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer store.Close()

	tokens, err := token.NewManager(cfg.JWTPrivateKeyPEM, cfg.JWTKeyID, cfg.PublicURL, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	if err != nil {
		log.Fatalf("token manager: %v", err)
	}

	google := oauth.NewGoogle(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.PublicURL+"/v1/callback/google")
	srv := httpapi.NewServer(cfg, store, tokens, google)
	if err := srv.BootstrapClients(ctx); err != nil {
		log.Fatalf("bootstrap clients: %v", err)
	}

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("auth listening on %s", cfg.Addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
}

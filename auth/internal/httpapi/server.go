package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/fookie/cloud/auth/internal/config"
	"github.com/fookie/cloud/auth/internal/db"
	"github.com/fookie/cloud/auth/internal/domain"
	"github.com/fookie/cloud/auth/internal/oauth"
	"github.com/fookie/cloud/auth/internal/token"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
)

type Server struct {
	cfg    config.Config
	store  *db.Store
	google *oauth.Google
	tokens *token.Manager
}

type loginState struct {
	ClientID            string `json:"client_id"`
	RedirectURI         string `json:"redirect_uri"`
	State               string `json:"state"`
	CodeChallenge       string `json:"code_challenge,omitempty"`
	CodeChallengeMethod string `json:"code_challenge_method,omitempty"`
	Nonce               string `json:"nonce"`
}

func NewServer(cfg config.Config, store *db.Store, tokens *token.Manager, google *oauth.Google) *Server {
	return &Server{cfg: cfg, store: store, tokens: tokens, google: google}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(accessAndMetrics)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	origins := s.cfg.AllowedOrigins
	if len(origins) == 0 {
		origins = []string{"*"}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Handle("/metrics", metricsHandler())
	r.Get("/healthz", s.handleHealth)
	r.Get("/.well-known/openid-configuration", s.handleOpenIDConfiguration)
	r.Get("/.well-known/jwks.json", s.handleJWKS)
	r.Get("/jwks.json", s.handleJWKS)

	r.Route("/v1", func(r chi.Router) {
		r.Get("/login", s.handleLogin)
		r.Get("/callback/google", s.handleGoogleCallback)
		r.Post("/token", s.handleToken)
		r.Get("/userinfo", s.handleUserInfo)
		r.Post("/logout", s.handleLogout)
		r.Get("/clients", s.handleListClients)
		r.Get("/api-keys", s.handleListAPIKeys)
		r.Post("/api-keys", s.handleCreateAPIKey)
		r.Delete("/api-keys/{id}", s.handleRevokeAPIKey)
		r.Post("/introspect", s.handleIntrospect)
	})

	return r
}

func (s *Server) BootstrapClients(ctx context.Context) error {
	for _, c := range s.cfg.Clients {
		if err := s.store.UpsertClient(ctx, c.ID, c.Name, c.RedirectURIs); err != nil {
			return fmt.Errorf("upsert client %s: %w", c.ID, err)
		}
	}
	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleOpenIDConfiguration(w http.ResponseWriter, _ *http.Request) {
	base := s.cfg.PublicURL
	writeJSON(w, http.StatusOK, map[string]any{
		"issuer":                                base,
		"authorization_endpoint":                base + "/v1/login",
		"token_endpoint":                        base + "/v1/token",
		"userinfo_endpoint":                     base + "/v1/userinfo",
		"jwks_uri":                              base + "/.well-known/jwks.json",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"scopes_supported":                      []string{"openid", "email", "profile"},
		"token_endpoint_auth_methods_supported": []string{"none"},
		"code_challenge_methods_supported":      []string{"S256", "plain"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
	})
}

func (s *Server) handleJWKS(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.tokens.JWKS())
}

func (s *Server) handleListClients(w http.ResponseWriter, _ *http.Request) {
	out := make([]map[string]string, 0, len(s.cfg.Clients))
	for _, c := range s.cfg.Clients {
		out = append(out, map[string]string{"id": c.ID, "name": c.Name})
	}
	writeJSON(w, http.StatusOK, map[string]any{"clients": out})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	clientID := strings.TrimSpace(r.URL.Query().Get("client_id"))
	redirectURI := strings.TrimSpace(r.URL.Query().Get("redirect_uri"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	codeChallenge := strings.TrimSpace(r.URL.Query().Get("code_challenge"))
	codeChallengeMethod := strings.TrimSpace(r.URL.Query().Get("code_challenge_method"))

	if clientID == "" || redirectURI == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "client_id and redirect_uri are required")
		return
	}

	client, err := s.store.GetClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to load client")
		return
	}
	if client == nil {
		writeError(w, http.StatusBadRequest, "invalid_client", "unknown client_id")
		return
	}
	if !containsURI(client.RedirectURIs, redirectURI) {
		writeError(w, http.StatusBadRequest, "invalid_request", "redirect_uri is not allowed for this client")
		return
	}
	if codeChallenge != "" && codeChallengeMethod == "" {
		codeChallengeMethod = "S256"
	}

	payload := loginState{
		ClientID:            clientID,
		RedirectURI:         redirectURI,
		State:               state,
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
	}

	if user := s.sessionUser(r); user != nil {
		if err := s.completeLogin(w, r, user, payload); err != nil {
			writeError(w, http.StatusInternalServerError, "server_error", "failed to complete login")
			return
		}
		return
	}

	nonce, err := randomState(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to create state")
		return
	}
	payload.Nonce = nonce

	encoded, err := encodeState(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to encode state")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "fookie_oauth_state",
		Value:    encoded,
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   strings.HasPrefix(s.cfg.PublicURL, "https://"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((10 * time.Minute).Seconds()),
	})

	http.Redirect(w, r, s.google.AuthCodeURL(encoded), http.StatusFound)
}

func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	if errMsg := r.URL.Query().Get("error"); errMsg != "" {
		writeError(w, http.StatusBadRequest, "access_denied", errMsg)
		return
	}

	code := r.URL.Query().Get("code")
	stateParam := r.URL.Query().Get("state")
	if code == "" || stateParam == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "missing code or state")
		return
	}

	cookie, err := r.Cookie("fookie_oauth_state")
	if err != nil || cookie.Value == "" || cookie.Value != stateParam {
		writeError(w, http.StatusBadRequest, "invalid_state", "oauth state mismatch")
		return
	}

	payload, err := decodeState(stateParam)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_state", "oauth state is invalid")
		return
	}

	profile, err := s.google.Exchange(r.Context(), code)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "google authentication failed")
		return
	}

	user, err := s.store.UpsertGoogleUser(r.Context(), profile.Sub, profile.Email, profile.Name, profile.Picture)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to persist user")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "fookie_oauth_state",
		Value:    "",
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   strings.HasPrefix(s.cfg.PublicURL, "https://"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	if err := s.setSessionCookie(w, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to create session")
		return
	}

	if err := s.completeLogin(w, r, user, payload); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to complete login")
		return
	}
}

type tokenRequest struct {
	GrantType    string `json:"grant_type"`
	Code         string `json:"code"`
	RedirectURI  string `json:"redirect_uri"`
	ClientID     string `json:"client_id"`
	CodeVerifier string `json:"code_verifier"`
	RefreshToken string `json:"refresh_token"`
}

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	req, err := parseTokenRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	switch req.GrantType {
	case "authorization_code":
		s.exchangeCode(w, r, req)
	case "refresh_token":
		s.refresh(w, r, req)
	default:
		writeError(w, http.StatusBadRequest, "unsupported_grant_type", "supported: authorization_code, refresh_token")
	}
}

func (s *Server) exchangeCode(w http.ResponseWriter, r *http.Request, req tokenRequest) {
	if req.Code == "" || req.ClientID == "" || req.RedirectURI == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "code, client_id and redirect_uri are required")
		return
	}

	ac, err := s.store.ConsumeAuthCode(r.Context(), req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to consume auth code")
		return
	}
	if ac == nil {
		writeError(w, http.StatusBadRequest, "invalid_grant", "authorization code is invalid or expired")
		return
	}
	if ac.ClientID != req.ClientID || ac.RedirectURI != req.RedirectURI {
		writeError(w, http.StatusBadRequest, "invalid_grant", "client_id or redirect_uri mismatch")
		return
	}
	if ac.CodeChallenge != "" {
		if req.CodeVerifier == "" || !token.VerifyPKCE(ac.CodeChallengeMethod, ac.CodeChallenge, req.CodeVerifier) {
			writeError(w, http.StatusBadRequest, "invalid_grant", "pkce validation failed")
			return
		}
	}

	user, err := s.store.GetUser(r.Context(), ac.UserID)
	if err != nil || user == nil {
		writeError(w, http.StatusInternalServerError, "server_error", "user not found")
		return
	}

	pair, err := s.issuePair(r.Context(), user, ac.ClientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to issue tokens")
		return
	}
	writeJSON(w, http.StatusOK, pair)
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request, req tokenRequest) {
	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "refresh_token is required")
		return
	}

	hash := token.HashToken(req.RefreshToken)
	rt, err := s.store.GetRefreshTokenByHash(r.Context(), hash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to load refresh token")
		return
	}
	if rt == nil || rt.RevokedAt != nil || time.Now().UTC().After(rt.ExpiresAt) {
		writeError(w, http.StatusBadRequest, "invalid_grant", "refresh token is invalid or expired")
		return
	}
	if req.ClientID != "" && req.ClientID != rt.ClientID {
		writeError(w, http.StatusBadRequest, "invalid_grant", "client_id mismatch")
		return
	}

	_ = s.store.RevokeRefreshToken(r.Context(), rt.ID)

	user, err := s.store.GetUser(r.Context(), rt.UserID)
	if err != nil || user == nil {
		writeError(w, http.StatusInternalServerError, "server_error", "user not found")
		return
	}

	pair, err := s.issuePair(r.Context(), user, rt.ClientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to issue tokens")
		return
	}
	writeJSON(w, http.StatusOK, pair)
}

func (s *Server) issuePair(ctx context.Context, user *domain.User, clientID string) (map[string]any, error) {
	access, _, err := s.tokens.IssueAccessToken(user.ID, user.Email, user.Name, clientID)
	if err != nil {
		return nil, err
	}

	idToken, err := s.tokens.IssueIDToken(user.ID, user.Email, user.Name, clientID)
	if err != nil {
		return nil, err
	}

	rawRefresh, err := token.RandomURLToken(48)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := s.store.CreateRefreshToken(ctx, domain.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		ClientID:  clientID,
		TokenHash: token.HashToken(rawRefresh),
		ExpiresAt: now.Add(s.tokens.RefreshTTL()),
		CreatedAt: now,
	}); err != nil {
		return nil, err
	}

	return map[string]any{
		"access_token":  access,
		"id_token":      idToken,
		"refresh_token": rawRefresh,
		"token_type":    "Bearer",
		"expires_in":    s.tokens.AccessTTLSeconds(),
	}, nil
}

func (s *Server) handleUserInfo(w http.ResponseWriter, r *http.Request) {
	claims, err := s.bearerClaims(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
		return
	}

	if claims.TokenUse == token.TokenUseAPIKey {
		if err := s.ensureAPIKeyActive(r.Context(), claims); err != nil {
			writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
			return
		}
	}

	user, err := s.store.GetUser(r.Context(), claims.Subject)
	if err != nil || user == nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", "user not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"sub":            user.ID,
		"email":          user.Email,
		"email_verified": true,
		"name":           user.Name,
		"picture":        user.AvatarURL,
		"client_id":      claims.ClientID,
		"token_use":      claims.TokenUse,
		"created_at":     user.CreatedAt.UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
		ClientID     string `json:"client_id"`
		AllDevices   bool   `json:"all_devices"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if body.RefreshToken != "" {
		rt, err := s.store.GetRefreshTokenByHash(r.Context(), token.HashToken(body.RefreshToken))
		if err == nil && rt != nil {
			_ = s.store.RevokeRefreshToken(r.Context(), rt.ID)
			if body.AllDevices {
				_ = s.store.RevokeUserRefreshTokens(r.Context(), rt.UserID, body.ClientID)
			}
		}
	} else if claims, err := s.bearerClaims(r); err == nil {
		_ = s.store.RevokeUserRefreshTokens(r.Context(), claims.Subject, body.ClientID)
	}

	s.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) sessionUser(r *http.Request) *domain.User {
	cookie, err := r.Cookie("fookie_session")
	if err != nil || cookie.Value == "" {
		return nil
	}
	claims, err := s.tokens.ParseSessionToken(cookie.Value)
	if err != nil {
		return nil
	}
	user, err := s.store.GetUser(r.Context(), claims.Subject)
	if err != nil || user == nil {
		return nil
	}
	return user
}

func (s *Server) setSessionCookie(w http.ResponseWriter, userID string) error {
	raw, err := s.tokens.IssueSessionToken(userID, 30*24*time.Hour)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "fookie_session",
		Value:    raw,
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   strings.HasPrefix(s.cfg.PublicURL, "https://"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
	})
	return nil
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "fookie_session",
		Value:    "",
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   strings.HasPrefix(s.cfg.PublicURL, "https://"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (s *Server) completeLogin(w http.ResponseWriter, r *http.Request, user *domain.User, payload loginState) error {
	authCode, err := token.RandomURLToken(32)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	if err := s.store.CreateAuthCode(r.Context(), domain.AuthCode{
		Code:                authCode,
		UserID:              user.ID,
		ClientID:            payload.ClientID,
		RedirectURI:         payload.RedirectURI,
		CodeChallenge:       payload.CodeChallenge,
		CodeChallengeMethod: payload.CodeChallengeMethod,
		ExpiresAt:           now.Add(s.cfg.AuthCodeTTL),
		CreatedAt:           now,
	}); err != nil {
		return err
	}

	redirectURL, err := url.Parse(payload.RedirectURI)
	if err != nil {
		return err
	}
	q := redirectURL.Query()
	q.Set("code", authCode)
	if payload.State != "" {
		q.Set("state", payload.State)
	}
	redirectURL.RawQuery = q.Encode()
	http.Redirect(w, r, redirectURL.String(), http.StatusFound)
	return nil
}

func (s *Server) bearerClaims(r *http.Request) (*token.AccessClaims, error) {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(h), "bearer ") {
		return nil, errors.New("missing bearer token")
	}
	raw := strings.TrimSpace(h[7:])
	return s.tokens.ParseAccessToken(raw)
}

func (s *Server) requireUser(r *http.Request) (*domain.User, error) {
	claims, err := s.bearerClaims(r)
	if err != nil {
		return nil, err
	}
	if claims.TokenUse == token.TokenUseAPIKey {
		return nil, errors.New("api keys cannot manage api keys")
	}
	user, err := s.store.GetUser(r.Context(), claims.Subject)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (s *Server) ensureAPIKeyActive(ctx context.Context, claims *token.AccessClaims) error {
	if claims.ID == "" {
		return errors.New("api key missing jti")
	}
	key, err := s.store.GetAPIKeyByJTI(ctx, claims.ID)
	if err != nil {
		return errors.New("failed to load api key")
	}
	if key == nil || key.RevokedAt != nil {
		return errors.New("api key revoked")
	}
	if time.Now().UTC().After(key.ExpiresAt) {
		return errors.New("api key expired")
	}
	return nil
}

func (s *Server) handleListAPIKeys(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
		return
	}
	keys, err := s.store.ListAPIKeys(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to list api keys")
		return
	}
	out := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		hint := k.TokenPrefix
		if strings.HasPrefix(hint, "eyJ") {
			hint = ""
		}
		item := map[string]any{
			"id":         k.ID,
			"name":       k.Name,
			"created_at": k.CreatedAt.UTC().Format(time.RFC3339),
			"expires_at": k.ExpiresAt.UTC().Format(time.RFC3339),
			"revoked":    k.RevokedAt != nil,
		}
		if hint != "" {
			item["prefix"] = hint
		}
		out = append(out, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": out})
}

func (s *Server) handleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
		return
	}

	var body struct {
		Name           string `json:"name"`
		ExpiresInDays  int    `json:"expires_in_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid json body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}
	days := body.ExpiresInDays
	if days <= 0 {
		days = 365
	}
	if days > 3650 {
		days = 3650
	}

	jti := uuid.NewString()
	ttl := time.Duration(days) * 24 * time.Hour
	raw, exp, err := s.tokens.IssueAPIKeyToken(user.ID, user.Email, user.Name, jti, ttl)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to issue api key")
		return
	}

	prefix := "fk_" + strings.ReplaceAll(jti, "-", "")[:8]
	now := time.Now().UTC()
	id := uuid.NewString()
	if err := s.store.CreateAPIKey(r.Context(), domain.APIKey{
		ID:          id,
		UserID:      user.ID,
		Name:        name,
		TokenPrefix: prefix,
		JTI:         jti,
		TokenHash:   token.HashToken(raw),
		ExpiresAt:   exp,
		CreatedAt:   now,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to store api key")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":         id,
		"name":       name,
		"prefix":     prefix,
		"key":        raw,
		"created_at": now.Format(time.RFC3339),
		"expires_at": exp.UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleRevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "id is required")
		return
	}
	key, err := s.store.GetAPIKeyByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to load api key")
		return
	}
	if key == nil || key.UserID != user.ID {
		writeError(w, http.StatusNotFound, "not_found", "api key not found")
		return
	}
	if err := s.store.RevokeAPIKey(r.Context(), id, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to revoke api key")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleIntrospect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Token) == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "token is required")
		return
	}

	claims, err := s.tokens.ParseAccessToken(strings.TrimSpace(body.Token))
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"active": false})
		return
	}

	active := true
	if claims.TokenUse == token.TokenUseAPIKey {
		if err := s.ensureAPIKeyActive(r.Context(), claims); err != nil {
			active = false
		}
	} else if claims.ExpiresAt != nil && time.Now().UTC().After(claims.ExpiresAt.Time) {
		active = false
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"active":    active,
		"sub":       claims.Subject,
		"client_id": claims.ClientID,
		"token_use": claims.TokenUse,
		"email":     claims.Email,
		"name":      claims.Name,
		"jti":       claims.ID,
		"exp": func() any {
			if claims.ExpiresAt == nil {
				return nil
			}
			return claims.ExpiresAt.Unix()
		}(),
	})
}

func parseTokenRequest(r *http.Request) (tokenRequest, error) {
	ct := r.Header.Get("Content-Type")
	if strings.Contains(ct, "application/json") {
		var req tokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			return tokenRequest{}, errors.New("invalid json body")
		}
		return req, nil
	}

	if err := r.ParseForm(); err != nil {
		return tokenRequest{}, errors.New("invalid form body")
	}
	return tokenRequest{
		GrantType:    r.Form.Get("grant_type"),
		Code:         r.Form.Get("code"),
		RedirectURI:  r.Form.Get("redirect_uri"),
		ClientID:     r.Form.Get("client_id"),
		CodeVerifier: r.Form.Get("code_verifier"),
		RefreshToken: r.Form.Get("refresh_token"),
	}, nil
}

func containsURI(list []string, uri string) bool {
	for _, item := range list {
		if item == uri {
			return true
		}
	}
	return false
}

func encodeState(v loginState) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func decodeState(raw string) (loginState, error) {
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return loginState{}, err
	}
	var v loginState
	if err := json.Unmarshal(b, &v); err != nil {
		return loginState{}, err
	}
	if v.ClientID == "" || v.RedirectURI == "" {
		return loginState{}, errors.New("incomplete state")
	}
	return v, nil
}

func randomState(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"error":             code,
		"error_description": message,
	})
}

package token

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Manager struct {
	privateKey *rsa.PrivateKey
	keyID      string
	issuer     string
	accessTTL  time.Duration
	refreshTTL time.Duration
}

const PlatformClientID = "fookie"
const TokenUseAPIKey = "api_key"

type AccessClaims struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	ClientID string `json:"client_id"`
	TokenUse string `json:"token_use,omitempty"`
	jwt.RegisteredClaims
}

type SessionClaims struct {
	Kind string `json:"kind"`
	jwt.RegisteredClaims
}

type Pair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int64
	TokenType    string
}

func NewManager(privateKeyPEM, keyID, issuer string, accessTTL, refreshTTL time.Duration) (*Manager, error) {
	block, _ := pem.Decode([]byte(normalizePEM(privateKeyPEM)))
	if block == nil {
		return nil, fmt.Errorf("invalid JWT private key PEM")
	}

	var key *rsa.PrivateKey
	var err error
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		parsed, parseErr := x509.ParsePKCS8PrivateKey(block.Bytes)
		if parseErr != nil {
			return nil, parseErr
		}
		var ok bool
		key, ok = parsed.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("JWT private key must be RSA")
		}
	default:
		return nil, fmt.Errorf("unsupported PEM block type %q", block.Type)
	}
	if err != nil {
		return nil, err
	}

	return &Manager{
		privateKey: key,
		keyID:      keyID,
		issuer:     issuer,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}, nil
}

func (m *Manager) IssueAccessToken(userID, email, name, clientID string) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(m.accessTTL)
	claims := AccessClaims{
		Email:    email,
		Name:     name,
		ClientID: clientID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   userID,
			Audience:  []string{clientID},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        uuid.NewString(),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	t.Header["kid"] = m.keyID
	signed, err := t.SignedString(m.privateKey)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

func (m *Manager) IssueAPIKeyToken(userID, email, name, jti string, ttl time.Duration) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(ttl)
	claims := AccessClaims{
		Email:    email,
		Name:     name,
		ClientID: PlatformClientID,
		TokenUse: TokenUseAPIKey,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   userID,
			Audience:  []string{PlatformClientID},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        jti,
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	t.Header["kid"] = m.keyID
	signed, err := t.SignedString(m.privateKey)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

func (m *Manager) ParseAccessToken(raw string) (*AccessClaims, error) {
	parsed, err := jwt.ParseWithClaims(raw, &AccessClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return &m.privateKey.PublicKey, nil
	}, jwt.WithIssuer(m.issuer))
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*AccessClaims)
	if !ok || !parsed.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func (m *Manager) IssueSessionToken(userID string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := SessionClaims{
		Kind: "session",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   userID,
			Audience:  []string{"fookie-sso"},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        uuid.NewString(),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	t.Header["kid"] = m.keyID
	return t.SignedString(m.privateKey)
}

func (m *Manager) ParseSessionToken(raw string) (*SessionClaims, error) {
	parsed, err := jwt.ParseWithClaims(raw, &SessionClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return &m.privateKey.PublicKey, nil
	}, jwt.WithIssuer(m.issuer), jwt.WithAudience("fookie-sso"))
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*SessionClaims)
	if !ok || !parsed.Valid || claims.Kind != "session" || claims.Subject == "" {
		return nil, fmt.Errorf("invalid session")
	}
	return claims, nil
}

func (m *Manager) RefreshTTL() time.Duration {
	return m.refreshTTL
}

func (m *Manager) AccessTTLSeconds() int64 {
	return int64(m.accessTTL.Seconds())
}

func (m *Manager) JWKS() map[string]any {
	pub := m.privateKey.PublicKey
	n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
	e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes())
	return map[string]any{
		"keys": []map[string]any{
			{
				"kty": "RSA",
				"use": "sig",
				"alg": "RS256",
				"kid": m.keyID,
				"n":   n,
				"e":   e,
			},
		},
	}
}

func RandomURLToken(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func VerifyPKCE(method, challenge, verifier string) bool {
	method = strings.ToUpper(strings.TrimSpace(method))
	if method == "" || method == "PLAIN" {
		return challenge == verifier
	}
	if method != "S256" {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(sum[:])
	return computed == challenge
}

func normalizePEM(v string) string {
	v = strings.TrimSpace(v)
	v = strings.Trim(v, `"'`)
	v = strings.ReplaceAll(v, `\n`, "\n")
	return v
}

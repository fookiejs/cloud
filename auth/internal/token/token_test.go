package token_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"testing"
	"time"

	"github.com/fookie/cloud/auth/internal/token"
)

func TestPKCEAndAccessToken(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	pemKey := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))

	mgr, err := token.NewManager(pemKey, "test", "https://auth.fookiecloud.com", time.Minute, time.Hour)
	if err != nil {
		t.Fatal(err)
	}

	access, _, err := mgr.IssueAccessToken("user-1", "a@b.c", "Ada", "script")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := mgr.ParseAccessToken(access)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != "user-1" || claims.ClientID != "script" {
		t.Fatalf("unexpected claims: %+v", claims)
	}

	verifier := "abc123verifier"
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	if !token.VerifyPKCE("S256", challenge, verifier) {
		t.Fatal("valid s256 pkce should match")
	}
	if token.VerifyPKCE("plain", verifier, verifier) {
		t.Fatal("plain pkce should fail")
	}
	if token.VerifyPKCE("S256", "nope", verifier) {
		t.Fatal("bad s256 should fail")
	}
}

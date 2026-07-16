package token_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
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
	sum := token.HashToken(verifier)
	_ = sum
	challengeRaw, err := token.RandomURLToken(32)
	if err != nil {
		t.Fatal(err)
	}
	if !token.VerifyPKCE("plain", challengeRaw, challengeRaw) {
		t.Fatal("plain pkce should match")
	}
	if token.VerifyPKCE("S256", "nope", verifier) {
		t.Fatal("bad s256 should fail")
	}
}

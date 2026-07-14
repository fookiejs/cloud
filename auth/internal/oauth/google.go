package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type GoogleProfile struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type Google struct {
	config *oauth2.Config
}

func NewGoogle(clientID, clientSecret, redirectURL string) *Google {
	return &Google{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		},
	}
}

func (g *Google) AuthCodeURL(state string) string {
	return g.config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "select_account"))
}

func (g *Google) Exchange(ctx context.Context, code string) (*GoogleProfile, error) {
	tok, err := g.config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("google exchange: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google userinfo status %d: %s", res.StatusCode, string(body))
	}

	var profile GoogleProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, err
	}
	if profile.Sub == "" || profile.Email == "" {
		return nil, fmt.Errorf("google profile missing sub/email")
	}
	return &profile, nil
}

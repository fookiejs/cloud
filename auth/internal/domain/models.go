package domain

import "time"

type User struct {
	ID        string
	Email     string
	Name      string
	AvatarURL string
	GoogleSub string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Client struct {
	ID           string
	Name         string
	RedirectURIs []string
	CreatedAt    time.Time
}

type AuthCode struct {
	Code                string
	UserID              string
	ClientID            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	ExpiresAt           time.Time
	ConsumedAt          *time.Time
	CreatedAt           time.Time
}

type RefreshToken struct {
	ID        string
	UserID    string
	ClientID  string
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}

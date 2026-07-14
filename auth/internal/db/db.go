package db

import (
	"context"
	"embed"
	"fmt"
	"strings"
	"time"

	"github.com/fookie/cloud/auth/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Store struct {
	pool *pgxpool.Pool
}

func Connect(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	s := &Store{pool: pool}
	if err := s.Migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Migrate(ctx context.Context) error {
	data, err := migrationsFS.ReadFile("migrations/001_init.sql")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	if _, err := s.pool.Exec(ctx, string(data)); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}

func (s *Store) UpsertClient(ctx context.Context, id, name string, redirectURIs []string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO clients (id, name, redirect_uris)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET name = EXCLUDED.name,
		    redirect_uris = EXCLUDED.redirect_uris
	`, id, name, redirectURIs)
	return err
}

func (s *Store) GetClient(ctx context.Context, id string) (*domain.Client, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, redirect_uris, created_at
		FROM clients
		WHERE id = $1
	`, id)
	var c domain.Client
	if err := row.Scan(&c.ID, &c.Name, &c.RedirectURIs, &c.CreatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (s *Store) UpsertGoogleUser(ctx context.Context, googleSub, email, name, avatarURL string) (*domain.User, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	row := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, email, name, avatar_url, google_sub, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		ON CONFLICT (google_sub) DO UPDATE
		SET email = EXCLUDED.email,
		    name = EXCLUDED.name,
		    avatar_url = EXCLUDED.avatar_url,
		    updated_at = EXCLUDED.updated_at
		RETURNING id, email, name, avatar_url, google_sub, created_at, updated_at
	`, id, email, name, avatarURL, googleSub, now)

	var u domain.User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.GoogleSub, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetUser(ctx context.Context, id string) (*domain.User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, name, avatar_url, google_sub, created_at, updated_at
		FROM users
		WHERE id = $1
	`, id)
	var u domain.User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.GoogleSub, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (s *Store) CreateAuthCode(ctx context.Context, code domain.AuthCode) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO auth_codes (
			code, user_id, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at, created_at
		) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, $8)
	`, code.Code, code.UserID, code.ClientID, code.RedirectURI, code.CodeChallenge, code.CodeChallengeMethod, code.ExpiresAt, code.CreatedAt)
	return err
}

func (s *Store) ConsumeAuthCode(ctx context.Context, code string) (*domain.AuthCode, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		SELECT code, user_id, client_id, redirect_uri,
		       COALESCE(code_challenge, ''), COALESCE(code_challenge_method, ''),
		       expires_at, consumed_at, created_at
		FROM auth_codes
		WHERE code = $1
		FOR UPDATE
	`, code)

	var ac domain.AuthCode
	if err := row.Scan(
		&ac.Code, &ac.UserID, &ac.ClientID, &ac.RedirectURI,
		&ac.CodeChallenge, &ac.CodeChallengeMethod,
		&ac.ExpiresAt, &ac.ConsumedAt, &ac.CreatedAt,
	); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if ac.ConsumedAt != nil || time.Now().UTC().After(ac.ExpiresAt) {
		return nil, nil
	}

	now := time.Now().UTC()
	if _, err := tx.Exec(ctx, `UPDATE auth_codes SET consumed_at = $2 WHERE code = $1`, code, now); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	ac.ConsumedAt = &now
	return &ac, nil
}

func (s *Store) CreateRefreshToken(ctx context.Context, rt domain.RefreshToken) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO refresh_tokens (id, user_id, client_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, rt.ID, rt.UserID, rt.ClientID, rt.TokenHash, rt.ExpiresAt, rt.CreatedAt)
	return err
}

func (s *Store) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, user_id, client_id, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`, tokenHash)
	var rt domain.RefreshToken
	if err := row.Scan(&rt.ID, &rt.UserID, &rt.ClientID, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &rt, nil
}

func (s *Store) RevokeRefreshToken(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE id = $1 AND revoked_at IS NULL
	`, id)
	return err
}

func (s *Store) RevokeUserRefreshTokens(ctx context.Context, userID, clientID string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`
	args := []any{userID}
	if strings.TrimSpace(clientID) != "" {
		query += ` AND client_id = $2`
		args = append(args, clientID)
	}
	_, err := s.pool.Exec(ctx, query, args...)
	return err
}

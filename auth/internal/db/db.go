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
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		names = append(names, e.Name())
	}
	for i := 0; i < len(names); i++ {
		for j := i + 1; j < len(names); j++ {
			if names[j] < names[i] {
				names[i], names[j] = names[j], names[i]
			}
		}
	}
	for _, name := range names {
		data, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		if _, err := s.pool.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
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

func (s *Store) CreateAPIKey(ctx context.Context, key domain.APIKey) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO api_keys (id, user_id, name, token_prefix, jti, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, key.ID, key.UserID, key.Name, key.TokenPrefix, key.JTI, key.TokenHash, key.ExpiresAt, key.CreatedAt)
	return err
}

func (s *Store) ListAPIKeys(ctx context.Context, userID string) ([]domain.APIKey, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, name, token_prefix, jti, token_hash, expires_at, revoked_at, created_at
		FROM api_keys
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.APIKey, 0)
	for rows.Next() {
		var k domain.APIKey
		if err := rows.Scan(
			&k.ID, &k.UserID, &k.Name, &k.TokenPrefix, &k.JTI, &k.TokenHash,
			&k.ExpiresAt, &k.RevokedAt, &k.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *Store) GetAPIKeyByID(ctx context.Context, id string) (*domain.APIKey, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, user_id, name, token_prefix, jti, token_hash, expires_at, revoked_at, created_at
		FROM api_keys
		WHERE id = $1
	`, id)
	var k domain.APIKey
	if err := row.Scan(
		&k.ID, &k.UserID, &k.Name, &k.TokenPrefix, &k.JTI, &k.TokenHash,
		&k.ExpiresAt, &k.RevokedAt, &k.CreatedAt,
	); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &k, nil
}

func (s *Store) GetAPIKeyByJTI(ctx context.Context, jti string) (*domain.APIKey, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, user_id, name, token_prefix, jti, token_hash, expires_at, revoked_at, created_at
		FROM api_keys
		WHERE jti = $1
	`, jti)
	var k domain.APIKey
	if err := row.Scan(
		&k.ID, &k.UserID, &k.Name, &k.TokenPrefix, &k.JTI, &k.TokenHash,
		&k.ExpiresAt, &k.RevokedAt, &k.CreatedAt,
	); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &k, nil
}

func (s *Store) RevokeAPIKey(ctx context.Context, id, userID string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE api_keys
		SET revoked_at = NOW()
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, id, userID)
	return err
}

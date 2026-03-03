package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDContextKey contextKey = "user_id"

func ParseJWT(secret []byte, tokenString string) (string, error) {
	t, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(t *jwt.Token) (interface{}, error) {
		return secret, nil
	})
	if err != nil || !t.Valid {
		return "", err
	}
	claims, ok := t.Claims.(*jwt.RegisteredClaims)
	if !ok || claims.Subject == "" {
		return "", jwt.ErrTokenInvalidClaims
	}
	return claims.Subject, nil
}

func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(UserIDContextKey).(string)
	return v
}

type AuthMiddleware struct {
	Secret []byte
}

func (m *AuthMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		userID, err := ParseJWT(m.Secret, token)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

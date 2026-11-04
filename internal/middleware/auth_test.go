package middleware

import (
	"testing"

	"github.com/myssh/myssh/internal/db"
)

func TestJWTGenerationAndParsing(t *testing.T) {
	secret := "test-secret-key-12345"
	user := &db.User{
		ID:       "usr-1",
		Username: "admin",
		Role:     "admin",
	}

	token, err := GenerateToken(user, secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	claims, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}

	if claims.UserID != user.ID || claims.Username != user.Username || claims.Role != user.Role {
		t.Errorf("Claims mismatch: got %+v, want %+v", claims, user)
	}
}

func TestJWTWrongSecret(t *testing.T) {
	user := &db.User{
		ID:       "usr-2",
		Username: "operator",
		Role:     "member",
	}

	token, err := GenerateToken(user, "secret-one")
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	_, err = ParseToken(token, "secret-two")
	if err == nil {
		t.Fatalf("Expected token parsing to fail with wrong secret")
	}
}

package sshhub

import (
	"net/http"
	"testing"
)

func TestIsOriginAllowed(t *testing.T) {
	// 1. Non-browser request (empty Origin header) -> Always allowed
	r1, _ := http.NewRequest("GET", "http://127.0.0.1:8080/ws", nil)
	if !IsOriginAllowed(r1, nil) {
		t.Errorf("Empty origin header must be allowed")
	}

	// 2. Same-host origin -> Allowed
	r2, _ := http.NewRequest("GET", "http://bastion.example.com/ws", nil)
	r2.Header.Set("Origin", "http://bastion.example.com")
	r2.Host = "bastion.example.com"
	if !IsOriginAllowed(r2, nil) {
		t.Errorf("Same-host origin must be allowed")
	}

	// 3. Default dev allowance (empty allowedOrigins) -> localhost allowed, attacker.com rejected
	r3, _ := http.NewRequest("GET", "http://127.0.0.1:8080/ws", nil)
	r3.Header.Set("Origin", "http://localhost:5173")
	if !IsOriginAllowed(r3, nil) {
		t.Errorf("Localhost dev origin must be allowed by default")
	}

	r4, _ := http.NewRequest("GET", "http://127.0.0.1:8080/ws", nil)
	r4.Header.Set("Origin", "http://malicious-attacker.com")
	if IsOriginAllowed(r4, nil) {
		t.Errorf("Arbitrary external origin must be rejected by default")
	}

	// 3b. Private IP range allowance by default (LAN/VPN access on custom ports)
	rLAN, _ := http.NewRequest("GET", "http://192.168.1.50:9090/ws", nil)
	rLAN.Header.Set("Origin", "http://192.168.1.50:9090")
	if !IsOriginAllowed(rLAN, nil) {
		t.Errorf("Private LAN origin must be allowed by default")
	}

	// 4. Explicit ALLOWED_ORIGINS whitelist
	whitelist := []string{"https://myssh.mycorp.internal", "https://admin.mycorp.internal"}
	r5, _ := http.NewRequest("GET", "http://myssh.mycorp.internal/ws", nil)
	r5.Header.Set("Origin", "https://myssh.mycorp.internal")
	if !IsOriginAllowed(r5, whitelist) {
		t.Errorf("Whitelisted origin must be allowed")
	}

	r6, _ := http.NewRequest("GET", "http://myssh.mycorp.internal/ws", nil)
	r6.Header.Set("Origin", "https://unauthorized-origin.com")
	if IsOriginAllowed(r6, whitelist) {
		t.Errorf("Non-whitelisted origin must be rejected when whitelist is set")
	}
}

package importer

import (
	"strings"
	"testing"
)

func TestParseSSHConfig(t *testing.T) {
	input := `
# Global defaults
User developer
Port 2222

Host *
    ServerAliveInterval 60

Host prod-api
    HostName 192.168.1.50
    User ubuntu
    Port 22
    IdentityFile ~/.ssh/prod.pem
    ProxyJump bastion

Host bastion
    HostName 203.0.113.10
    User ec2-user

Host internal-db
    HostName db.local
`

	hosts, err := ParseSSHConfig(strings.NewReader(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(hosts) != 3 {
		t.Fatalf("expected 3 hosts, got %d", len(hosts))
	}

	// 1. prod-api
	if hosts[0].Name != "prod-api" || hosts[0].Hostname != "192.168.1.50" || hosts[0].Port != 22 || hosts[0].Username != "ubuntu" || hosts[0].ProxyJump != "bastion" {
		t.Errorf("host[0] mismatch: %+v", hosts[0])
	}

	// 2. bastion
	if hosts[1].Name != "bastion" || hosts[1].Hostname != "203.0.113.10" || hosts[1].Username != "ec2-user" || hosts[1].Port != 2222 {
		t.Errorf("host[1] mismatch: %+v", hosts[1])
	}

	// 3. internal-db inherits global user
	if hosts[2].Name != "internal-db" || hosts[2].Hostname != "db.local" || hosts[2].Username != "developer" {
		t.Errorf("host[2] mismatch: %+v", hosts[2])
	}
}

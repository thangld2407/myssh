package importer

import (
	"bufio"
	"io"
	"strconv"
	"strings"
)

// ParsedSSHHost represents a host entry parsed from ~/.ssh/config.
type ParsedSSHHost struct {
	Name         string `json:"name"`
	Hostname     string `json:"hostname"`
	Port         int    `json:"port"`
	Username     string `json:"username"`
	IdentityFile string `json:"identity_file,omitempty"`
	ProxyJump    string `json:"proxy_jump,omitempty"`
}

// ParseSSHConfig parses OpenSSH config format and extracts individual host entries.
func ParseSSHConfig(r io.Reader) ([]ParsedSSHHost, error) {
	scanner := bufio.NewScanner(r)
	var hosts []ParsedSSHHost
	var current *ParsedSSHHost

	defaultUser := "root"
	defaultPort := 22

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on whitespace or '='
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		key := strings.ToLower(parts[0])
		val := strings.Join(parts[1:], " ")
		val = strings.Trim(val, `"'`)

		if key == "host" {
			// Save previous host if valid
			if current != nil && current.Name != "" && current.Name != "*" {
				if current.Hostname == "" {
					current.Hostname = current.Name
				}
				if current.Port == 0 {
					current.Port = defaultPort
				}
				if current.Username == "" {
					current.Username = defaultUser
				}
				hosts = append(hosts, *current)
			}

			// Do not treat wildcard "*" as an imported host
			if val == "*" {
				current = nil
				continue
			}

			current = &ParsedSSHHost{
				Name: val,
				Port: defaultPort,
			}
			continue
		}

		if current == nil {
			// Global configurations
			if key == "user" && val != "" {
				defaultUser = val
			} else if key == "port" {
				if p, err := strconv.Atoi(val); err == nil && p > 0 {
					defaultPort = p
				}
			}
			continue
		}

		switch key {
		case "hostname":
			current.Hostname = val
		case "user":
			current.Username = val
		case "port":
			if p, err := strconv.Atoi(val); err == nil && p > 0 {
				current.Port = p
			}
		case "identityfile":
			current.IdentityFile = val
		case "proxyjump":
			current.ProxyJump = val
		}
	}

	// Flush trailing host
	if current != nil && current.Name != "" && current.Name != "*" {
		if current.Hostname == "" {
			current.Hostname = current.Name
		}
		if current.Port == 0 {
			current.Port = defaultPort
		}
		if current.Username == "" {
			current.Username = defaultUser
		}
		hosts = append(hosts, *current)
	}

	return hosts, scanner.Err()
}

package sshhub

import (
	"testing"
)

func TestParseMetricsOutput(t *testing.T) {
	sampleOutput := `
OS="Ubuntu 24.04 LTS"
KERNEL=6.8.0-40-generic
ARCH=x86_64
UPTIME_SEC=172800
LOAD=0.15, 0.22, 0.18
MEM_TOTAL_KB=16384000
MEM_AVAIL_KB=8192000
CPU_PERCENT=18.5
DISK_TOTAL_KB=104857600
DISK_USED_KB=41943040
DISK_AVAIL_KB=62914560
DISK_PERCENT=40%
`

	m := parseMetricsOutput(sampleOutput)

	if m.OS != "Ubuntu 24.04 LTS" {
		t.Errorf("Expected OS 'Ubuntu 24.04 LTS', got '%s'", m.OS)
	}
	if m.Kernel != "6.8.0-40-generic" {
		t.Errorf("Expected Kernel '6.8.0-40-generic', got '%s'", m.Kernel)
	}
	if m.Arch != "x86_64" {
		t.Errorf("Expected Arch 'x86_64', got '%s'", m.Arch)
	}
	if m.UptimeText != "2d 0h" {
		t.Errorf("Expected UptimeText '2d 0h', got '%s'", m.UptimeText)
	}
	if m.CPUPercent != 18.5 {
		t.Errorf("Expected CPUPercent 18.5, got %f", m.CPUPercent)
	}
	if m.MemTotalMB != 16000 {
		t.Errorf("Expected MemTotalMB 16000, got %d", m.MemTotalMB)
	}
	if m.MemUsedMB != 8000 {
		t.Errorf("Expected MemUsedMB 8000, got %d", m.MemUsedMB)
	}
	if m.MemPercent != 50.0 {
		t.Errorf("Expected MemPercent 50.0, got %f", m.MemPercent)
	}
	if m.DiskPercent != 40.0 {
		t.Errorf("Expected DiskPercent 40.0, got %f", m.DiskPercent)
	}
}

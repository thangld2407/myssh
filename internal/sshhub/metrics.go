package sshhub

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"time"
)

type ServerMetrics struct {
	OS          string  `json:"os"`
	Kernel      string  `json:"kernel"`
	Arch        string  `json:"arch"`
	UptimeSec   int64   `json:"uptime_sec"`
	UptimeText  string  `json:"uptime_text"`
	LoadAvg     string  `json:"load_avg"`
	CPUPercent  float64 `json:"cpu_percent"`
	MemTotalMB  int64   `json:"mem_total_mb"`
	MemUsedMB   int64   `json:"mem_used_mb"`
	MemFreeMB   int64   `json:"mem_free_mb"`
	MemPercent  float64 `json:"mem_percent"`
	DiskTotalGB float64 `json:"disk_total_gb"`
	DiskUsedGB  float64 `json:"disk_used_gb"`
	DiskFreeGB  float64 `json:"disk_free_gb"`
	DiskPercent float64 `json:"disk_percent"`
	UpdatedAt   string  `json:"updated_at"`
}

const metricsScript = `sh -c '
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "OS=$PRETTY_NAME"
elif [ "$(uname -s)" = "Darwin" ]; then
  echo "OS=macOS $(sw_vers -productVersion 2>/dev/null)"
else
  echo "OS=$(uname -s)"
fi
echo "KERNEL=$(uname -r)"
echo "ARCH=$(uname -m)"

if [ -f /proc/uptime ]; then
  read -r up_sec _ < /proc/uptime
  echo "UPTIME_SEC=${up_sec%%.*}"
else
  echo "UPTIME_SEC=0"
fi

if [ -f /proc/loadavg ]; then
  read -r l1 l5 l15 _ < /proc/loadavg
  echo "LOAD=$l1, $l5, $l15"
elif command -v uptime >/dev/null 2>&1; then
  echo "LOAD=$(uptime | awk -F "load average:" "{print \$2}" | sed "s/^ //")"
fi

if [ -f /proc/meminfo ]; then
  awk "
    /MemTotal/ { t=\$2 }
    /MemAvailable/ { a=\$2 }
    /MemFree/ { f=\$2 }
    /Buffers/ { b=\$2 }
    /Cached/ { c=\$2 }
    END {
      print \"MEM_TOTAL_KB=\" t;
      if (a > 0) print \"MEM_AVAIL_KB=\" a;
      else print \"MEM_AVAIL_KB=\" (f + b + c);
    }
  " /proc/meminfo
fi

if [ -f /proc/stat ]; then
  read -r _ u1 n1 s1 i1 w1 q1 sq1 _ < /proc/stat
  sleep 0.2
  read -r _ u2 n2 s2 i2 w2 q2 sq2 _ < /proc/stat
  prev_idle=$((i1 + w1))
  idle=$((i2 + w2))
  prev_total=$((u1 + n1 + s1 + i1 + w1 + q1 + sq1))
  total=$((u2 + n2 + s2 + i2 + w2 + q2 + sq2))
  total_d=$((total - prev_total))
  idle_d=$((idle - prev_idle))
  if [ $total_d -gt 0 ]; then
    cpu_util=$(( (total_d - idle_d) * 100 / total_d ))
    echo "CPU_PERCENT=$cpu_util"
  else
    echo "CPU_PERCENT=0"
  fi
fi

df -k / 2>/dev/null | tail -n 1 | awk "{print \"DISK_TOTAL_KB=\" \$2; print \"DISK_USED_KB=\" \$3; print \"DISK_AVAIL_KB=\" \$4; print \"DISK_PERCENT=\" \$5}"
'`

func CollectServerMetrics(info SSHConnectionInfo) (*ServerMetrics, error) {
	client, err := GlobalPool.GetSSHClient(info)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to host: %w", err)
	}

	session, err := client.NewSession()
	if err != nil && info.Host != nil && IsConnError(err) {
		// Stale pooled connection dropped while idle: invalidate and retry once with fresh connection
		GlobalPool.Invalidate(info.Host.ID)
		client, err = GlobalPool.GetSSHClient(info)
		if err != nil {
			return nil, fmt.Errorf("failed to reconnect to host: %w", err)
		}
		session, err = client.NewSession()
	}
	if err != nil {
		return nil, fmt.Errorf("failed to open SSH session: %w", err)
	}
	defer session.Close()

	var stdoutBuf bytes.Buffer
	session.Stdout = &stdoutBuf

	if err := session.Run(metricsScript); err != nil {
		// Even if script has partial error, try to parse what we have
		if stdoutBuf.Len() == 0 {
			return nil, fmt.Errorf("failed to execute metrics probe: %w", err)
		}
	}

	metrics := parseMetricsOutput(stdoutBuf.String())
	return metrics, nil
}

func parseMetricsOutput(out string) *ServerMetrics {
	m := &ServerMetrics{
		OS:        "Linux",
		Arch:      "x86_64",
		UpdatedAt: time.Now().Format("15:04:05"),
	}

	var memTotalKB, memAvailKB int64
	var diskTotalKB, diskUsedKB, diskAvailKB int64

	lines := strings.Split(out, "\n")
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		k := strings.TrimSpace(parts[0])
		v := strings.TrimSpace(parts[1])

		switch k {
		case "OS":
			if v != "" {
				m.OS = strings.Trim(v, "\"")
			}
		case "KERNEL":
			m.Kernel = v
		case "ARCH":
			m.Arch = v
		case "UPTIME_SEC":
			sec, _ := strconv.ParseInt(v, 10, 64)
			m.UptimeSec = sec
			m.UptimeText = formatUptime(sec)
		case "LOAD":
			m.LoadAvg = v
		case "CPU_PERCENT":
			p, _ := strconv.ParseFloat(v, 64)
			if p < 0 {
				p = 0
			} else if p > 100 {
				p = 100
			}
			m.CPUPercent = p
		case "MEM_TOTAL_KB":
			memTotalKB, _ = strconv.ParseInt(v, 10, 64)
		case "MEM_AVAIL_KB":
			memAvailKB, _ = strconv.ParseInt(v, 10, 64)
		case "DISK_TOTAL_KB":
			diskTotalKB, _ = strconv.ParseInt(v, 10, 64)
		case "DISK_USED_KB":
			diskUsedKB, _ = strconv.ParseInt(v, 10, 64)
		case "DISK_AVAIL_KB":
			diskAvailKB, _ = strconv.ParseInt(v, 10, 64)
		case "DISK_PERCENT":
			v = strings.TrimSuffix(v, "%")
			dp, _ := strconv.ParseFloat(v, 64)
			m.DiskPercent = dp
		}
	}

	// Calculate memory values
	if memTotalKB > 0 {
		m.MemTotalMB = memTotalKB / 1024
		m.MemFreeMB = memAvailKB / 1024
		m.MemUsedMB = m.MemTotalMB - m.MemFreeMB
		if m.MemUsedMB < 0 {
			m.MemUsedMB = 0
		}
		m.MemPercent = float64(m.MemUsedMB) * 100.0 / float64(m.MemTotalMB)
		m.MemPercent = roundFloat(m.MemPercent, 1)
	}

	// Calculate disk values
	if diskTotalKB > 0 {
		m.DiskTotalGB = roundFloat(float64(diskTotalKB)/(1024*1024), 1)
		m.DiskUsedGB = roundFloat(float64(diskUsedKB)/(1024*1024), 1)
		m.DiskFreeGB = roundFloat(float64(diskAvailKB)/(1024*1024), 1)
		if m.DiskPercent == 0 && m.DiskTotalGB > 0 {
			m.DiskPercent = roundFloat(m.DiskUsedGB*100.0/m.DiskTotalGB, 1)
		}
	}

	return m
}

func formatUptime(sec int64) string {
	if sec <= 0 {
		return "N/A"
	}
	days := sec / 86400
	hours := (sec % 86400) / 3600
	mins := (sec % 3600) / 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh", days, hours)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, mins)
	}
	return fmt.Sprintf("%dm", mins)
}

func roundFloat(val float64, precision int) float64 {
	ratio := 1.0
	for i := 0; i < precision; i++ {
		ratio *= 10.0
	}
	return float64(int(val*ratio+0.5)) / ratio
}

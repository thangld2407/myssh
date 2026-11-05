package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:dist
var DistFS embed.FS

// GetFS returns an http.FileSystem rooted at dist/
func GetFS() (http.FileSystem, error) {
	sub, err := fs.Sub(DistFS, "dist")
	if err != nil {
		return nil, err
	}
	return http.FS(sub), nil
}

package k8shub

import (
	"context"
	"fmt"
	"io"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

type PodLogOptions struct {
	Namespace  string
	PodName    string
	Container  string
	TailLines  *int64
	Follow     bool
	Timestamps bool
	Previous   bool
}

// StreamPodLogs reads pod logs and copies them to the provided writer
func StreamPodLogs(ctx context.Context, cs *kubernetes.Clientset, opts PodLogOptions, writer io.Writer) error {
	k8sLogOpts := &corev1.PodLogOptions{
		Container:  opts.Container,
		Follow:     opts.Follow,
		Timestamps: opts.Timestamps,
		Previous:   opts.Previous,
	}
	if opts.TailLines != nil && *opts.TailLines > 0 {
		k8sLogOpts.TailLines = opts.TailLines
	}

	req := cs.CoreV1().Pods(opts.Namespace).GetLogs(opts.PodName, k8sLogOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return fmt.Errorf("failed to open log stream: %w", err)
	}
	defer stream.Close()

	buf := make([]byte, 4096)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			n, err := stream.Read(buf)
			if n > 0 {
				if _, wErr := writer.Write(buf[:n]); wErr != nil {
					return wErr
				}
				if flusher, ok := writer.(interface{ Flush() }); ok {
					flusher.Flush()
				}
			}
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return err
			}
		}
	}
}

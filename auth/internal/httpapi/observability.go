package httpapi

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"service", "method", "route", "status_class"})

	httpDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request duration",
		Buckets: prometheus.DefBuckets,
	}, []string{"service", "method", "route", "status_class"})

	httpInFlight = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "http_requests_in_flight",
		Help: "In-flight HTTP requests",
		ConstLabels: prometheus.Labels{
			"service": "auth",
		},
	})
)

func statusClass(code int) string {
	switch {
	case code >= 500:
		return "5xx"
	case code >= 400:
		return "4xx"
	case code >= 300:
		return "3xx"
	case code >= 200:
		return "2xx"
	default:
		return "1xx"
	}
}

func normalizeRoute(r *http.Request) string {
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		if p := rctx.RoutePattern(); p != "" {
			return p
		}
	}
	path := r.URL.Path
	if path == "" {
		return "/"
	}
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if p == "" {
			continue
		}
		if len(p) > 20 || looksLikeID(p) {
			parts[i] = ":id"
		}
	}
	return strings.Join(parts, "/")
}

func looksLikeID(s string) bool {
	if len(s) >= 32 {
		return true
	}
	_, err := strconv.ParseUint(s, 10, 64)
	return err == nil
}

func clientIP(r *http.Request) string {
	candidates := []string{
		r.Header.Get("CF-Connecting-IP"),
		r.Header.Get("True-Client-IP"),
		r.Header.Get("X-Real-IP"),
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			candidates = append(candidates, strings.TrimSpace(part))
		}
	}
	for _, raw := range candidates {
		if raw == "" {
			continue
		}
		host := raw
		if h, _, err := net.SplitHostPort(raw); err == nil {
			host = h
		}
		ip := net.ParseIP(host)
		if ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
			continue
		}
		return host
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type accessLine struct {
	Msg        string  `json:"msg"`
	Service    string  `json:"service"`
	ClientIP   string  `json:"client_ip"`
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Status     int     `json:"status"`
	DurationMs float64 `json:"duration_ms"`
	RequestID  string  `json:"request_id"`
}

func accessAndMetrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" || r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		httpInFlight.Inc()
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		defer func() {
			httpInFlight.Dec()
			dur := time.Since(start)
			code := ww.Status()
			if code == 0 {
				code = http.StatusOK
			}
			route := normalizeRoute(r)
			sc := statusClass(code)
			httpRequests.WithLabelValues("auth", r.Method, route, sc).Inc()
			httpDuration.WithLabelValues("auth", r.Method, route, sc).Observe(dur.Seconds())
			line := accessLine{
				Msg:        "http_access",
				Service:    "auth",
				ClientIP:   clientIP(r),
				Method:     r.Method,
				Path:       r.URL.Path,
				Status:     code,
				DurationMs: float64(dur.Milliseconds()),
				RequestID:  middleware.GetReqID(r.Context()),
			}
			b, err := json.Marshal(line)
			if err == nil {
				_, _ = fmt.Fprintln(os.Stdout, string(b))
			}
		}()
		next.ServeHTTP(ww, r)
	})
}

func metricsHandler() http.Handler {
	return promhttp.Handler()
}

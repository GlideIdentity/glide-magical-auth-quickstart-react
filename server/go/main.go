package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/GlideIdentity/glide-be-sdk-go/v2/magicalauth"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

var magicalAuth *magicalauth.Client

type HealthCheckResponse struct {
	Status           string `json:"status"`
	SDK              string `json:"sdk"`
	SDKInitialized   bool   `json:"sdkInitialized"`
	Env              struct {
		HasClientID     bool `json:"hasClientId"`
		HasClientSecret bool `json:"hasClientSecret"`
	} `json:"env"`
}

type ErrorResponse struct {
	Error     string                 `json:"error"`
	Message   string                 `json:"message"`
	RequestID string                 `json:"requestId,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

func main() {
	// Load environment variables from root .env file
	// Try root level first (when run via npm scripts), then current dir (for direct execution)
	err := godotenv.Load("../../.env")
	if err != nil {
		err = godotenv.Load(".env")
		if err != nil {
			log.Println("No .env file found, using environment variables")
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// Initialize Magical Auth SDK with OAuth2 credentials
	clientID := os.Getenv("GLIDE_CLIENT_ID")
	clientSecret := os.Getenv("GLIDE_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		log.Println("⚠️  Missing OAuth2 credentials. Please set GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET in your .env file.")
	} else {
		cfg := magicalauth.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
		}
		if baseURL := os.Getenv("GLIDE_API_BASE_URL"); baseURL != "" {
			cfg.BaseURL = baseURL
		}

		client, err := magicalauth.NewClient(cfg)
		if err != nil {
			log.Fatalf("Failed to initialize Magical Auth SDK: %v", err)
		}
		magicalAuth = client
		log.Println("✅ Magical Auth SDK initialized with OAuth2")
	}

	// Setup routes
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/api/health", healthCheckHandler)

	// Magical Auth endpoints
	mux.HandleFunc("/api/magical-auth/prepare", phoneAuthPrepareHandler)
	mux.HandleFunc("/api/magical-auth/report-invocation", phoneAuthInvokeHandler)
	mux.HandleFunc("/api/magical-auth/process", phoneAuthProcessHandler)

	// Device binding: completion page (GET) and complete endpoint (POST)
	mux.HandleFunc("/glide-complete", glideCompletePageHandler)
	mux.HandleFunc("/api/magical-auth/complete", phoneAuthCompleteHandler)

	// CORS: device binding requires credentials: 'include' for HttpOnly cookie passthrough
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(mux)

	log.Printf("🚀 Server running on http://localhost:%s\n", port)
	log.Println("📦 SDK: magicalauth (MagicalAuth Go SDK)")

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

// =============================================================================
// Health Check
// =============================================================================

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := HealthCheckResponse{
		Status:         "ok",
		SDK:            "magicalauth",
		SDKInitialized: magicalAuth != nil,
	}
	response.Env.HasClientID = os.Getenv("GLIDE_CLIENT_ID") != ""
	response.Env.HasClientSecret = os.Getenv("GLIDE_CLIENT_SECRET") != ""

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// =============================================================================
// Prepare — initiates the authentication flow
// =============================================================================

func phoneAuthPrepareHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if magicalAuth == nil {
		sendErrorResponse(w, http.StatusServiceUnavailable, "SDK_NOT_INITIALIZED",
			"Magical Auth SDK not initialized. Check your credentials.", nil)
		return
	}

	var req magicalauth.PrepareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	log.Printf("📱 Prepare request: { use_case: '%s' }\n", req.UseCase)

	// Apply default PLMN for GetPhoneNumber if not provided
	if req.UseCase == magicalauth.UseCaseGetPhoneNumber && (req.PLMN == nil || req.PLMN.MCC == "") {
		log.Println("📶 PLMN not provided, defaulting to T-Mobile US (310/260)")
		req.PLMN = &magicalauth.PLMN{MCC: "310", MNC: "260"}
	}

	// SDK auto-generates fe_code/fe_hash for device binding (link strategy)
	result, err := magicalAuth.Prepare(context.Background(), &req)
	if err != nil {
		handleSDKError(w, err)
		return
	}

	log.Printf("✅ Prepare success: { strategy: '%s', session_key: '%s' }\n",
		result.AuthenticationStrategy, result.Session.SessionKey)

	// Device binding: set HttpOnly cookie with fe_code for link strategy.
	// The SDK's Prepare already generated fe_code — we just need to persist it as a cookie.
	if result.FeCode != "" && result.Session.SessionKey != "" {
		isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
		cookieOpts := &magicalauth.BindingCookieOptions{Secure: isSecure}

		// Clear any stale binding cookies from abandoned flows
		for _, sc := range magicalauth.ClearStaleBindingCookies(r.Header.Get("Cookie"), cookieOpts) {
			w.Header().Add("Set-Cookie", sc)
		}

		cookie, err := magicalauth.BuildSetBindingCookieHeader(result.FeCode, result.Session.SessionKey, cookieOpts)
		if err == nil {
			w.Header().Add("Set-Cookie", cookie)
			log.Println("🔒 Device binding cookie set for link strategy")
		}
	}

	// Return the prepare response (feCode is NOT included — it's JSON:"-" in the SDK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// =============================================================================
// Invoke — reports invocation for ASR tracking (non-blocking)
// =============================================================================

func phoneAuthInvokeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var reqBody struct {
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "reason": "invalid_request_body"})
		return
	}

	if reqBody.SessionID == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "reason": "missing_session_id"})
		return
	}

	if magicalAuth == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "reason": "client_not_configured"})
		return
	}

	sessionPreview := reqBody.SessionID
	if len(sessionPreview) > 8 {
		sessionPreview = sessionPreview[:8] + "..."
	}
	log.Printf("📊 [Invoke] Reporting invocation for session: %s\n", sessionPreview)

	result, err := magicalAuth.ReportInvocation(context.Background(), &magicalauth.ReportInvocationRequest{
		SessionID: reqBody.SessionID,
	})
	if err != nil {
		// Log the error but NEVER fail the HTTP response
		log.Printf("❌ [Invoke] Failed to report invocation (non-blocking): %v\n", err)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	success := result.Status == magicalauth.ReportStatusSuccess
	log.Printf("✅ [Invoke] Report response: success=%v\n", success)
	json.NewEncoder(w).Encode(map[string]bool{"success": success})
}

// =============================================================================
// Process — dispatches to getPhoneNumber or verifyPhoneNumber
// =============================================================================

func phoneAuthProcessHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if magicalAuth == nil {
		sendErrorResponse(w, http.StatusServiceUnavailable, "SDK_NOT_INITIALIZED",
			"Magical Auth SDK not initialized. Check your credentials.", nil)
		return
	}

	var reqBody struct {
		UseCase    string                 `json:"use_case"`
		Session    magicalauth.SessionInfo `json:"session"`
		Credential string                 `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	log.Printf("🔐 Process request: { use_case: '%s' }\n", reqBody.UseCase)

	if reqBody.UseCase == "" || reqBody.Credential == "" {
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"use_case and credential are required", nil)
		return
	}

	// Read the device binding code from the HttpOnly cookie set during prepare.
	// This extends device binding verification to the process step (link protocol only).
	feCode := magicalauth.ParseBindingCookie(r.Header.Get("Cookie"), reqBody.Session.SessionKey)
	if feCode != "" {
		log.Println("🔒 Device binding cookie found for process step")
	}

	var result interface{}
	var err error

	switch magicalauth.UseCase(reqBody.UseCase) {
	case magicalauth.UseCaseGetPhoneNumber:
		response, e := magicalAuth.GetPhoneNumber(context.Background(), &magicalauth.GetPhoneNumberRequest{
			Session:    reqBody.Session,
			Credential: reqBody.Credential,
			FeCode:     feCode,
		})
		if e == nil {
			log.Printf("✅ GetPhoneNumber success: { phone_number: '%s****' }\n", response.PhoneNumber[:6])
		}
		result = response
		err = e
	case magicalauth.UseCaseVerifyPhoneNumber:
		response, e := magicalAuth.VerifyPhoneNumber(context.Background(), &magicalauth.VerifyPhoneNumberRequest{
			Session:    reqBody.Session,
			Credential: reqBody.Credential,
			FeCode:     feCode,
		})
		if e == nil {
			log.Printf("✅ VerifyPhoneNumber success: { verified: %v }\n", response.Verified)
		}
		result = response
		err = e
	default:
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			fmt.Sprintf("Invalid use_case. Must be '%s' or '%s', got: %s",
				magicalauth.UseCaseGetPhoneNumber, magicalauth.UseCaseVerifyPhoneNumber, reqBody.UseCase), nil)
		return
	}

	if err != nil {
		handleSDKError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// =============================================================================
// Device Binding: Completion Page
// =============================================================================

/**
 * Completion redirect page — served after carrier authentication.
 *
 * The aggregator redirects the phone browser to this URL with agg_code and
 * session_key in the URL fragment. The page extracts them, writes a localStorage
 * signal for the original tab, and POSTs to /api/magical-auth/complete (the browser
 * auto-attaches the _glide_bind HttpOnly cookie).
 */
func glideCompletePageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// The SDK provides the completion page HTML — no inline HTML needed
	html, err := magicalauth.GetCompletionPageHTML("/api/magical-auth/complete")
	if err != nil {
		sendErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate completion page", nil)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Write([]byte(html))
}

// =============================================================================
// Device Binding: Complete Endpoint
// =============================================================================

/**
 * Complete endpoint — called by the completion redirect page.
 *
 * Reads fe_code from the _glide_bind HttpOnly cookie (auto-attached by the browser),
 * agg_code and session_key from the POST body, and forwards all three to the
 * aggregator's /complete endpoint. Returns 204 on success.
 */
func phoneAuthCompleteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if magicalAuth == nil {
		sendErrorResponse(w, http.StatusServiceUnavailable, "SDK_NOT_INITIALIZED",
			"Magical Auth SDK not initialized.", nil)
		return
	}

	var reqBody struct {
		SessionKey string `json:"session_key"`
		AggCode    string `json:"agg_code"`
		UserAgent  string `json:"user_agent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	if reqBody.SessionKey == "" || reqBody.AggCode == "" {
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"session_key and agg_code are required", nil)
		return
	}

	// Read fe_code from the session-scoped HttpOnly cookie (set during prepare)
	feCode := magicalauth.ParseBindingCookie(r.Header.Get("Cookie"), reqBody.SessionKey)
	if feCode == "" {
		log.Printf("❌ Complete: missing binding cookie for session %s\n", truncateForLog(reqBody.SessionKey))
		sendErrorResponse(w, http.StatusForbidden, "MISSING_BINDING_COOKIE",
			"Device binding cookie is missing. The prepare and complete must happen in the same browser.", nil)
		return
	}

	log.Printf("🔐 Complete request for session: %s...\n", truncateForLog(reqBody.SessionKey))

	// The SDK validates the binding codes and completes the session
	_, err := magicalAuth.Complete(context.Background(), &magicalauth.CompleteRequest{
		SessionKey: reqBody.SessionKey,
		FeCode:     feCode,
		AggCode:    reqBody.AggCode,
		UserAgent:  reqBody.UserAgent,
	})
	if err != nil {
		handleSDKError(w, err)
		return
	}

	log.Println("✅ Complete succeeded")

	// The device binding cookie is intentionally not cleared here — it is needed
	// by the process step (/verify-phone-number or /get-phone-number) for continued
	// device binding validation. The cookie auto-expires after 5 minutes.
	w.WriteHeader(http.StatusNoContent)
}

// =============================================================================
// Error Handling
// =============================================================================

func handleSDKError(w http.ResponseWriter, err error) {
	if apiErr, ok := err.(*magicalauth.APIError); ok {
		log.Printf("❌ MagicalAuthError: code=%s, status=%d, message=%s\n",
			apiErr.Code, apiErr.Status, apiErr.Message)

		status := apiErr.Status
		if status == 0 {
			status = http.StatusInternalServerError
		}

		sendErrorResponse(w, status, string(apiErr.Code), apiErr.Message, nil)
	} else {
		log.Printf("❌ Unexpected error: %v\n", err)
		sendErrorResponse(w, http.StatusInternalServerError, "UNEXPECTED_ERROR", err.Error(), nil)
	}
}

func truncateForLog(s string) string {
	if len(s) > 8 {
		return s[:8]
	}
	return s
}

func sendErrorResponse(w http.ResponseWriter, status int, code, message string, details map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	response := ErrorResponse{
		Error:   code,
		Message: message,
	}
	if details != nil {
		response.Details = details
	}

	json.NewEncoder(w).Encode(response)
}

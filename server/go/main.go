package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	glide "github.com/GlideIdentity/glide-be-sdk-go/v2"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

var glideClient *glide.Client

type HealthCheckResponse struct {
	Status           string   `json:"status"`
	GlideInitialized bool     `json:"glideInitialized"`
	GlideProperties  []string `json:"glideProperties"`
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

	// Initialize Glide client with OAuth2 credentials
	clientID := os.Getenv("GLIDE_CLIENT_ID")
	clientSecret := os.Getenv("GLIDE_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		log.Println("⚠️  Missing OAuth2 credentials. Please set GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET in your .env file.")
	} else {
		// Determine log level
		logLevel := glide.LogLevelInfo
		if os.Getenv("GLIDE_DEBUG") == "true" {
			logLevel = glide.LogLevelDebug
		}

		// Initialize the Glide SDK with OAuth2 credentials
		glideClient = glide.New(
			glide.WithClientCredentials(clientID, clientSecret),
			glide.WithLogLevel(logLevel),
		)
		log.Println("✅ Glide SDK initialized with OAuth2")
	}

	// Setup routes
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/api/health", healthCheckHandler)

	// Phone Auth endpoints
	mux.HandleFunc("/api/phone-auth/prepare", phoneAuthPrepareHandler)
	mux.HandleFunc("/api/phone-auth/invoke", phoneAuthInvokeHandler)
	mux.HandleFunc("/api/phone-auth/process", phoneAuthProcessHandler)
	mux.HandleFunc("/api/phone-auth/status/", phoneAuthStatusHandler)

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
		Debug:          false,
	})

	handler := c.Handler(mux)

	log.Printf("Server running on http://localhost:%s\n", port)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	clientID := os.Getenv("GLIDE_CLIENT_ID")
	clientSecret := os.Getenv("GLIDE_CLIENT_SECRET")

	response := HealthCheckResponse{
		Status:           "ok",
		GlideInitialized: glideClient != nil,
		GlideProperties:  []string{"magicalAuth"},
	}

	response.Env.HasClientID = clientID != ""
	response.Env.HasClientSecret = clientSecret != ""

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func phoneAuthPrepareHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if glideClient == nil {
		sendErrorResponse(w, http.StatusServiceUnavailable, "SDK_NOT_INITIALIZED",
			"Glide SDK not initialized. Check your credentials.", nil)
		return
	}

	var req glide.PrepareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	log.Printf("📱 Prepare request: { use_case: '%s' }\n", req.UseCase)

	// Set default T-Mobile PLMN for GetPhoneNumber if neither phone_number nor PLMN provided
	if req.UseCase == glide.UseCaseGetPhoneNumber && req.PhoneNumber == "" && (req.PLMN == nil || req.PLMN.MCC == "" || req.PLMN.MNC == "") {
		log.Println("No phone_number or PLMN provided for GetPhoneNumber, using default T-Mobile PLMN")
		req.PLMN = &glide.PLMN{
			MCC: "310",
			MNC: "260", // T-Mobile USA
		}
	}

	// Use the SDK to prepare the request
	ctx, cancel := glideClient.Context()
	defer cancel()

	response, err := glideClient.MagicalAuth.Prepare(ctx, &req)
	if err != nil {
		handleGlideError(w, err)
		return
	}

	log.Printf("✅ Prepare success: { strategy: '%s', session_key: '%s' }\n",
		response.AuthenticationStrategy, response.Session.SessionKey)

	// Store status_url for the polling proxy endpoint
	if statusURL := ExtractStatusURL(response); statusURL != "" {
		StoreStatusURL(response.Session.SessionKey, statusURL)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// phoneAuthInvokeHandler reports that an authentication flow was started.
// This call can be made asynchronously without blocking the flow.
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
		log.Println("⚠️ [Invoke] Failed to decode request body")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "reason": "invalid_request_body"})
		return
	}

	if reqBody.SessionID == "" {
		log.Println("⚠️ [Invoke] No session_id provided, skipping invocation report")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "reason": "missing_session_id"})
		return
	}

	if glideClient == nil {
		log.Println("⚠️ [Invoke] SDK not initialized, skipping invocation report")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "reason": "client_not_configured"})
		return
	}

	// Log a truncated session ID for debugging
	sessionIDPreview := reqBody.SessionID
	if len(sessionIDPreview) > 8 {
		sessionIDPreview = sessionIDPreview[:8] + "..."
	}
	log.Printf("📊 [Invoke] Reporting invocation for session: %s\n", sessionIDPreview)

	// Call SDK and return actual response
	ctx, cancel := glideClient.Context()
	defer cancel()

	result, err := glideClient.MagicalAuth.ReportInvocation(ctx, &glide.ReportInvocationRequest{
		SessionID: reqBody.SessionID,
	})
	if err != nil {
		// Log the error but NEVER fail the HTTP response
		log.Printf("❌ [Invoke] Failed to report invocation (non-blocking): %v\n", err)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	log.Printf("✅ [Invoke] Report response: success=%v\n", result.Success)
	json.NewEncoder(w).Encode(map[string]bool{"success": result.Success})
}

func phoneAuthProcessHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if glideClient == nil {
		sendErrorResponse(w, http.StatusServiceUnavailable, "SDK_NOT_INITIALIZED",
			"Glide SDK not initialized. Check your credentials.", nil)
		return
	}

	// Decode the request
	var reqBody struct {
		UseCase    string            `json:"use_case"`
		Session    glide.SessionInfo `json:"session"`
		Credential string            `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		log.Printf("Failed to decode request body: %v\n", err)
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	log.Printf("🔐 Process request: { use_case: '%s' }\n", reqBody.UseCase)

	// Validate required fields
	if reqBody.UseCase == "" || reqBody.Credential == "" {
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"use_case, session, and credential are required", nil)
		return
	}

	ctx, cancel := glideClient.Context()
	defer cancel()

	var result interface{}
	var err error

	// Call the appropriate SDK method based on use_case
	switch reqBody.UseCase {
	case "GetPhoneNumber":
		response, e := glideClient.MagicalAuth.GetPhoneNumber(ctx, &glide.GetPhoneNumberRequest{
			Session:    reqBody.Session,
			Credential: reqBody.Credential,
		})
		if e == nil {
			log.Printf("✅ GetPhoneNumber success: { phone_number: '%s****' }\n", response.PhoneNumber[:6])
		}
		result = response
		err = e
	case "VerifyPhoneNumber":
		response, e := glideClient.MagicalAuth.VerifyPhoneNumber(ctx, &glide.VerifyPhoneNumberRequest{
			Session:    reqBody.Session,
			Credential: reqBody.Credential,
		})
		if e == nil {
			log.Printf("✅ VerifyPhoneNumber success: { verified: %v }\n", response.Verified)
		}
		result = response
		err = e
	default:
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			fmt.Sprintf("Invalid use_case. Must be 'GetPhoneNumber' or 'VerifyPhoneNumber', got: %s", reqBody.UseCase), nil)
		return
	}

	if err != nil {
		handleGlideError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleGlideError(w http.ResponseWriter, err error) {
	if glideErr, ok := err.(*glide.MagicalAuthError); ok {
		log.Printf("❌ MagicalAuthError: code=%s, message=%s, status=%d\n",
			glideErr.Code, glideErr.Message, glideErr.Status)

		status := glideErr.Status
		if status == 0 {
			status = http.StatusInternalServerError
		}

		// Include all error fields in details
		allDetails := glideErr.Details
		if allDetails == nil {
			allDetails = make(map[string]interface{})
		}
		if glideErr.RequestID != "" {
			allDetails["requestId"] = glideErr.RequestID
		}
		allDetails["status"] = glideErr.Status

		sendErrorResponse(w, status, glideErr.Code, glideErr.Message, allDetails)
	} else {
		log.Printf("❌ Unexpected error: %v\n", err)
		sendErrorResponse(w, http.StatusInternalServerError, "UNEXPECTED_ERROR", err.Error(), nil)
	}
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
		if reqID, ok := details["request_id"].(string); ok {
			response.RequestID = reqID
		} else if reqID, ok := details["requestId"].(string); ok {
			response.RequestID = reqID
		}
	}

	json.NewEncoder(w).Encode(response)
}

func phoneAuthStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract session ID from the path
	path := strings.TrimPrefix(r.URL.Path, "/api/phone-auth/status/")
	sessionID := strings.TrimSpace(path)

	if sessionID == "" {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Session ID is required", nil)
		return
	}

	// Get the stored status URL from prepare response
	statusURL, found := GetStoredStatusURL(sessionID)
	if !found {
		sessionPreview := sessionID
		if len(sessionPreview) > 8 {
			sessionPreview = sessionPreview[:8] + "..."
		}
		log.Printf("[Status Proxy] No stored status URL for session: %s\n", sessionPreview)
		sendErrorResponse(w, http.StatusNotFound, "SESSION_NOT_FOUND",
			"Session not found. It may have expired or prepare was not called.", nil)
		return
	}

	sessionPreview := sessionID
	if len(sessionPreview) > 8 {
		sessionPreview = sessionPreview[:8] + "..."
	}
	log.Printf("[Status Proxy] Polling session: %s\n", sessionPreview)

	client := &http.Client{}
	req, err := http.NewRequest("GET", statusURL, nil)
	if err != nil {
		log.Printf("[Status Proxy] Error creating request: %v\n", err)
		sendErrorResponse(w, http.StatusInternalServerError, "REQUEST_ERROR",
			"Failed to create status request", nil)
		return
	}

	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[Status Proxy] Error fetching status: %v\n", err)
		sendErrorResponse(w, http.StatusInternalServerError, "STATUS_CHECK_FAILED",
			"Failed to check status", nil)
		return
	}
	defer resp.Body.Close()

	log.Printf("[Status Proxy] Status check returned %d\n", resp.StatusCode)

	// Read the response body
	var responseData interface{}
	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		log.Printf("[Status Proxy] Error decoding response: %v\n", err)
		sendErrorResponse(w, http.StatusInternalServerError, "DECODE_ERROR",
			"Failed to decode status response", nil)
		return
	}

	// Forward the response
	if resp.StatusCode >= 400 {
		w.WriteHeader(resp.StatusCode)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(responseData)
}

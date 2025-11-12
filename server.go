package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	glide "github.com/GlideIdentity/glide-be-sdk-go"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

type HealthCheckResponse struct {
	Status           string   `json:"status"`
	GlideInitialized bool     `json:"glideInitialized"`
	GlideProperties  []string `json:"glideProperties"`
	Env              struct {
		HasAPIKey  bool   `json:"hasApiKey"`
		APIBaseURL string `json:"apiBaseUrl"`
	} `json:"env"`
}

type ErrorResponse struct {
	Error     string                 `json:"error"`
	Message   string                 `json:"message"`
	RequestID string                 `json:"requestId,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

var glideClient *glide.Client

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// Check for debug mode from environment variables
	// Set GLIDE_DEBUG=true in your .env file to enable
	debugMode := os.Getenv("GLIDE_DEBUG") == "true"
	logLevel := os.Getenv("GLIDE_LOG_LEVEL")

	if debugMode || logLevel == "debug" {
		log.Println("🔍 Debug logging enabled for Glide SDK")
		log.Println("📊 Configuration:")
		log.Printf("  - GLIDE_DEBUG: %s", os.Getenv("GLIDE_DEBUG"))
		log.Printf("  - GLIDE_LOG_LEVEL: %s", logLevel)
		log.Println("📡 You will see detailed logs for:")
		log.Println("  - API request/response details")
		log.Println("  - Performance metrics")
		log.Println("  - Retry attempts")
		log.Println("  - Error context")
		log.Println("🔒 Sensitive data is automatically sanitized")
	}

	// Initialize Glide client
	apiKey := os.Getenv("GLIDE_API_KEY")
	if apiKey == "" {
		log.Println("⚠️  Missing Glide API key. Please check your .env file.")
	}

	apiBaseURL := os.Getenv("GLIDE_API_BASE_URL")
	if apiBaseURL == "" {
		apiBaseURL = "https://api.glideidentity.app"
	}

	opts := []glide.Option{
		glide.WithAPIKey(apiKey),
		glide.WithBaseURL(apiBaseURL),
	}

	// Add debug logging if enabled
	if debugMode {
		opts = append(opts, glide.WithDebug(true))
	}

	// Add log format if specified
	logFormat := os.Getenv("GLIDE_LOG_FORMAT")
	if logFormat != "" {
		switch logFormat {
		case "json":
			opts = append(opts, glide.WithLogFormat(glide.LogFormatJSON))
		case "simple":
			opts = append(opts, glide.WithLogFormat(glide.LogFormatSimple))
		case "pretty":
			opts = append(opts, glide.WithLogFormat(glide.LogFormatPretty))
		default:
			// Default to pretty if not specified
			opts = append(opts, glide.WithLogFormat(glide.LogFormatPretty))
		}
		if debugMode || logLevel == "debug" {
			log.Printf("  - GLIDE_LOG_FORMAT: %s", logFormat)
		}
	}

	glideClient = glide.New(opts...)

	// Setup routes
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/api/health", healthCheckHandler)

	// Phone Auth endpoints
	mux.HandleFunc("/api/phone-auth/prepare", phoneAuthPrepareHandler)
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
	log.Printf("Using Glide API: %s\n", apiBaseURL)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := HealthCheckResponse{
		Status:           "ok",
		GlideInitialized: glideClient != nil,
		GlideProperties:  []string{"magicAuth", "simSwap", "numberVerify", "kyc"},
	}

	response.Env.HasAPIKey = os.Getenv("GLIDE_API_KEY") != ""
	response.Env.APIBaseURL = os.Getenv("GLIDE_API_BASE_URL")
	if response.Env.APIBaseURL == "" {
		response.Env.APIBaseURL = "https://api.glideidentity.app"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func phoneAuthPrepareHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req glide.PrepareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	// Only log if not using pretty format to avoid duplicate logs
	if os.Getenv("GLIDE_LOG_FORMAT") != "pretty" {
		log.Printf("/api/phone-auth/prepare %+v\n", req)
	}

	// Set default T-Mobile PLMN for GetPhoneNumber if neither phone_number nor PLMN provided
	if req.UseCase == glide.UseCaseGetPhoneNumber && req.PhoneNumber == "" && (req.PLMN == nil || req.PLMN.MCC == "" || req.PLMN.MNC == "") {
		log.Println("No phone_number or PLMN provided for GetPhoneNumber, using default T-Mobile PLMN")
		req.PLMN = &glide.PLMN{
			MCC: "310",
			MNC: "260", // T-Mobile USA
		}
	}

	if os.Getenv("GLIDE_LOG_FORMAT") != "pretty" {
		log.Printf("Calling glide.MagicAuth.Prepare with: %+v\n", req)
	}

	// Call Glide SDK
	ctx := context.Background()
	response, err := glideClient.MagicAuth.Prepare(ctx, &req)
	if err != nil {
		handleGlideError(w, err)
		return
	}

	if os.Getenv("GLIDE_LOG_FORMAT") != "pretty" {
		log.Printf("Response from SDK: %+v\n", response)
	}

	// The Go SDK returns the response in the correct format
	if response.AuthenticationStrategy != "" && response.Data != nil && response.Session.SessionKey != "" {
		if os.Getenv("GLIDE_LOG_FORMAT") != "pretty" {
			log.Printf("Forwarding response from SDK: %+v\n", response)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	} else {
		sendErrorResponse(w, http.StatusInternalServerError, "UNEXPECTED_RESPONSE", "Unexpected response format from Glide SDK", nil)
	}
}

func phoneAuthProcessHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Decode the request body into a generic map to pass through
	var reqBody map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		log.Printf("Failed to decode request body: %v\n", err)
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	// Extract fields
	useCase, _ := reqBody["use_case"].(string)
	session := reqBody["session"]
	credential := reqBody["credential"]

	// Debug logging to understand what we're receiving
	sessionJSON, _ := json.Marshal(session)
	credentialStr := ""
	if credStr, ok := credential.(string); ok {
		if len(credStr) > 100 {
			credentialStr = credStr[:100] + "...[TRUNCATED]"
		} else {
			credentialStr = credStr
		}
	}

	if os.Getenv("GLIDE_LOG_FORMAT") != "pretty" {
		log.Printf("/api/phone-auth/process - UseCase: %s\n", useCase)
		log.Printf("Session received (size: %d bytes): %s\n", len(sessionJSON), string(sessionJSON))
		log.Printf("Credential received: %s\n", credentialStr)
	}

	// Validate required fields
	if useCase == "" || session == nil || credential == nil {
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"use_case, session, and credential are required", nil)
		return
	}

	ctx := context.Background()
	var result interface{}
	var err error

	// Call the appropriate SDK method based on use_case
	// The SDK now accepts the same structure the client sends
	if useCase == "GetPhoneNumber" {
		result, err = glideClient.MagicAuth.GetPhoneNumber(ctx, &glide.GetPhoneNumberRequest{
			Session:    session,
			Credential: credential,
		})
	} else if useCase == "VerifyPhoneNumber" {
		result, err = glideClient.MagicAuth.VerifyPhoneNumber(ctx, &glide.VerifyPhoneNumberRequest{
			Session:    session,
			Credential: credential,
		})
	} else {
		sendErrorResponse(w, http.StatusBadRequest, "VALIDATION_ERROR",
			fmt.Sprintf("Invalid use_case. Must be 'GetPhoneNumber' or 'VerifyPhoneNumber', got: %s", useCase), nil)
		return
	}

	if err != nil {
		handleGlideError(w, err)
		return
	}

	// Return the result as-is
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleGlideError(w http.ResponseWriter, err error) {
	if glideErr, ok := err.(*glide.Error); ok {
		log.Printf("GlideError details: code=%s, message=%s, status=%d, requestId=%s\n",
			glideErr.Code, glideErr.Message, glideErr.Status, glideErr.RequestID)

		status := glideErr.Status
		if status == 0 {
			status = http.StatusInternalServerError
		}

		// Include all error fields in details for proper error handling
		allDetails := glideErr.Details
		if allDetails == nil {
			allDetails = make(map[string]interface{})
		}
		// Add requestID if it exists (not in details)
		if glideErr.RequestID != "" {
			allDetails["requestId"] = glideErr.RequestID
		}
		// Add status for client reference
		allDetails["status"] = glideErr.Status

		sendErrorResponse(w, status, string(glideErr.Code), glideErr.Message, allDetails)
	} else {
		log.Printf("Unexpected error: %v\n", err)
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
	}

	// Add request ID if in details
	if details != nil {
		if reqID, ok := details["request_id"].(string); ok {
			response.RequestID = reqID
		} else if reqID, ok := details["requestId"].(string); ok {
			response.RequestID = reqID
		}
	}

	// Add stack trace in development
	if strings.ToLower(os.Getenv("NODE_ENV")) == "development" && details == nil {
		response.Details = map[string]interface{}{
			"env": "development",
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
	// Path format: /api/phone-auth/status/{sessionId}
	path := strings.TrimPrefix(r.URL.Path, "/api/phone-auth/status/")
	sessionID := strings.TrimSpace(path)

	if sessionID == "" {
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Session ID is required", nil)
		return
	}

	log.Printf("[Status Proxy] Fetching status for session: %s\n", sessionID)

	// Make request to the public status endpoint
	statusURL := fmt.Sprintf("https://api.glideidentity.app/public/public/status/%s", sessionID)

	req, err := http.NewRequest("GET", statusURL, nil)
	if err != nil {
		log.Printf("[Status Proxy] Error creating request: %v\n", err)
		sendErrorResponse(w, http.StatusInternalServerError, "REQUEST_ERROR",
			"Failed to create status request", nil)
		return
	}

	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
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

	log.Printf("[Status Proxy] Status response: %+v\n", responseData)

	// Forward the response
	if resp.StatusCode >= 400 {
		w.WriteHeader(resp.StatusCode)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(responseData)
}

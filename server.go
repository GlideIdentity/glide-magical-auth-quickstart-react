package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/ClearBlockchain/glide-sdk-go/glide"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

// Request/Response types
type PhoneAuthProcessRequest struct {
	Response    json.RawMessage `json:"response"`
	SessionInfo json.RawMessage `json:"sessionInfo"` // Required: full session info from prepare response
	PhoneNumber string          `json:"phoneNumber,omitempty"`
}

type AuthProcessResponse struct {
	PhoneNumber string `json:"phone_number"`
	Verified    bool   `json:"verified,omitempty"`
}

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

func getStringFromMap(m map[string]interface{}, key string, defaultValue string) string {
	if val, ok := m[key]; ok {
		if strVal, ok := val.(string); ok {
			return strVal
		}
	}
	return defaultValue
}

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

	glideClient = glide.New(opts...)

	// Setup routes
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/api/health", healthCheckHandler)

	// Phone Auth endpoints
	mux.HandleFunc("/api/phone-auth/prepare", phoneAuthPrepareHandler)
	mux.HandleFunc("/api/phone-auth/process", phoneAuthProcessHandler)

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

	log.Printf("/api/phone-auth/prepare %+v\n", req)

	// Set default T-Mobile PLMN for GetPhoneNumber if neither phone_number nor PLMN provided
	if req.UseCase == glide.UseCaseGetPhoneNumber && req.PhoneNumber == "" && (req.PLMN == nil || req.PLMN.MCC == "" || req.PLMN.MNC == "") {
		log.Println("No phone_number or PLMN provided for GetPhoneNumber, using default T-Mobile PLMN")
		req.PLMN = &glide.PLMN{
			MCC: "310",
			MNC: "260", // T-Mobile USA
		}
	}

	log.Printf("Calling glide.MagicAuth.Prepare with: %+v\n", req)

	// Call Glide SDK
	ctx := context.Background()
	response, err := glideClient.MagicAuth.Prepare(ctx, &req)
	if err != nil {
		handleGlideError(w, err)
		return
	}

	log.Printf("Response from SDK: %+v\n", response)

	// The Go SDK returns the response in the correct format
	if response.AuthenticationStrategy != "" && response.Data != nil && response.Session.SessionKey != "" {
		log.Printf("Forwarding response from SDK: %+v\n", response)
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

	var req PhoneAuthProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Failed to decode request body: %v\n", err)
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	log.Printf("/api/phone-auth/process - HasResponse: %v, HasSessionInfo: %v, PhoneNumber: %s\n",
		len(req.Response) > 0, len(req.SessionInfo) > 0, req.PhoneNumber)

	// Parse the response into a map
	var responseData map[string]interface{}
	if err := json.Unmarshal(req.Response, &responseData); err != nil {
		log.Printf("Failed to unmarshal response data: %v, raw: %s\n", err, string(req.Response))
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid response data", nil)
		return
	}

	// Parse SessionInfo (required)
	var sessionData map[string]interface{}
	if err := json.Unmarshal(req.SessionInfo, &sessionData); err != nil {
		log.Printf("Failed to unmarshal session info: %v\n", err)
		sendErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid session info", nil)
		return
	}

	// Determine which method to call based on whether phoneNumber is provided
	ctx := context.Background()
	var phoneNumber string
	var verified bool

	if req.PhoneNumber != "" {
		// Use VerifyPhoneNumber when a phone number is provided
		// Build SessionInfo from sessionData
		sessionInfo := &glide.SessionInfo{
			SessionKey: getStringFromMap(sessionData, "session_key", ""),
			Nonce:      getStringFromMap(sessionData, "nonce", ""),
			EncKey:     getStringFromMap(sessionData, "enc_key", ""),
		}

		verifyReq := glide.VerifyPhoneNumberRequest{
			SessionInfo: sessionInfo,
			Credential:  responseData,
		}

		log.Printf("Calling glide.MagicAuth.VerifyPhoneNumber with SessionInfo: {SessionKey:%s, Nonce:%s, EncKey:...}\n",
			sessionInfo.SessionKey, sessionInfo.Nonce)

		result, err := glideClient.MagicAuth.VerifyPhoneNumber(ctx, &verifyReq)
		if err != nil {
			handleGlideError(w, err)
			return
		}

		log.Printf("VerifyPhoneNumber Response: %+v\n", result)
		phoneNumber = result.PhoneNumber
		verified = result.Verified
	} else {
		// Use GetPhoneNumber when no phone number is provided
		// Build SessionInfo from sessionData
		sessionInfo := &glide.SessionInfo{
			SessionKey: getStringFromMap(sessionData, "session_key", ""),
			Nonce:      getStringFromMap(sessionData, "nonce", ""),
			EncKey:     getStringFromMap(sessionData, "enc_key", ""),
		}

		getReq := glide.GetPhoneNumberRequest{
			SessionInfo: sessionInfo,
			Credential:  responseData,
		}

		log.Printf("Calling glide.MagicAuth.GetPhoneNumber with SessionInfo: {SessionKey:%s, Nonce:%s, EncKey:...}\n",
			sessionInfo.SessionKey, sessionInfo.Nonce)

		result, err := glideClient.MagicAuth.GetPhoneNumber(ctx, &getReq)
		if err != nil {
			handleGlideError(w, err)
			return
		}

		log.Printf("GetPhoneNumber Response: %+v\n", result)
		phoneNumber = result.PhoneNumber
		verified = false // GetPhoneNumber doesn't verify
	}

	// Return the result
	response := AuthProcessResponse{
		PhoneNumber: phoneNumber,
		Verified:    verified,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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

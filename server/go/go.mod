module magical-auth-quickstart-go

go 1.21

require (
	github.com/GlideIdentity/glide-be-sdk-go v1.1.0
	github.com/joho/godotenv v1.5.1
	github.com/rs/cors v1.10.1
)

require github.com/GlideIdentity/glide-be-sdk-go/core v1.2.2 // indirect

// Use local development SDK with ReportInvocation support
replace github.com/GlideIdentity/glide-be-sdk-go => ../../../../backend-sdks/replica-be-sdk-go

replace github.com/GlideIdentity/glide-be-sdk-go/core => ../../../../backend-sdks/replica-be-sdk-go/core

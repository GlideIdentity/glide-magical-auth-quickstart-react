module magical-auth-quickstart-go

go 1.24

require (
	github.com/GlideIdentity/glide-be-sdk-go/v2 v2.3.0
	github.com/joho/godotenv v1.5.1
	github.com/rs/cors v1.10.1
)

replace github.com/GlideIdentity/glide-be-sdk-go/v2 => ../../../../backend-sdks/publish-magical-auth-be-sdks/sdks/go

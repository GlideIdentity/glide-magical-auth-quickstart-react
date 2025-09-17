module magical-auth-quickstart-go

go 1.21

require (
	github.com/ClearBlockchain/glide-sdk-go v0.0.0
	github.com/joho/godotenv v1.5.1
	github.com/rs/cors v1.10.1
)

require golang.org/x/time v0.5.0 // indirect

replace github.com/ClearBlockchain/glide-sdk-go => ../glide-go-sdk

package main

import (
	"log"
	"net/http"

	"hits-classroom/internal/repository/memory"
	httphandler "hits-classroom/internal/transport/http"
	"hits-classroom/internal/usecase"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/health", httphandler.NewHealthHandler())

	userRepo := memory.NewUserRepository()
	registerUC := usecase.NewRegister(userRepo, usecase.BcryptHasher{})
	mux.Handle("/api/v1/auth/register", httphandler.NewRegisterHandler(registerUC))

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

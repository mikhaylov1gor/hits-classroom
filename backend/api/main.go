package main

import (
	"log"
	"net/http"

	httphandler "hits-classroom/internal/transport/http"
)

func main() {
	mux := http.NewServeMux()
	healthHandler := httphandler.NewHealthHandler()
	mux.Handle("/health", healthHandler)

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

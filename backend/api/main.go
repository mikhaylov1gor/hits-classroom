package main

import (
	"log"
	"net/http"
	"time"

	"hits-classroom/internal/repository/memory"
	httphandler "hits-classroom/internal/transport/http"
	"hits-classroom/internal/usecase"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/health", httphandler.NewHealthHandler())

	jwtSecret := []byte("dev-secret-change-in-production")
	userRepo := memory.NewUserRepository()
	hasher := usecase.BcryptHasher{}
	registerUC := usecase.NewRegister(userRepo, hasher)
	mux.Handle("/api/v1/auth/register", httphandler.NewRegisterHandler(registerUC))

	jwtIssuer := &usecase.JWTIssuer{Secret: jwtSecret, Expiry: 24 * time.Hour}
	loginUC := usecase.NewLogin(userRepo, hasher, jwtIssuer)
	mux.Handle("/api/v1/auth/login", httphandler.NewLoginHandler(loginUC))

	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	createCourseUC := usecase.NewCreateCourse(courseRepo, memberRepo)
	authMiddleware := &httphandler.AuthMiddleware{Secret: jwtSecret}
	mux.Handle("/api/v1/courses", authMiddleware.Handler(httphandler.NewCreateCourseHandler(createCourseUC)))

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

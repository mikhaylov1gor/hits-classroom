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
	authMiddleware := &httphandler.AuthMiddleware{Secret: jwtSecret}
	createCourseUC := usecase.NewCreateCourse(courseRepo, memberRepo)
	joinCourseUC := usecase.NewJoinCourse(courseRepo, memberRepo)
	listCoursesUC := usecase.NewListCourses(courseRepo, memberRepo)
	getCourseUC := usecase.NewGetCourse(courseRepo, memberRepo)
	coursesHandler := httphandler.NewCoursesHandler(
		httphandler.NewListCoursesHandler(listCoursesUC),
		httphandler.NewCreateCourseHandler(createCourseUC),
	)
	mux.Handle("GET /api/v1/courses/{courseId}", authMiddleware.Handler(httphandler.NewGetCourseHandler(getCourseUC)))
	mux.Handle("/api/v1/courses/join", authMiddleware.Handler(httphandler.NewJoinCourseHandler(joinCourseUC)))
	mux.Handle("/api/v1/courses", authMiddleware.Handler(coursesHandler))

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

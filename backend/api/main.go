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
	jwtIssuer := &usecase.JWTIssuer{Secret: jwtSecret, Expiry: 24 * time.Hour}
	userRepo := memory.NewUserRepository()
	hasher := usecase.BcryptHasher{}
	registerUC := usecase.NewRegister(userRepo, hasher, jwtIssuer)
	mux.Handle("/api/v1/auth/register", httphandler.NewRegisterHandler(registerUC))

	loginUC := usecase.NewLogin(userRepo, hasher, jwtIssuer)
	mux.Handle("/api/v1/auth/login", httphandler.NewLoginHandler(loginUC))

	authWrap := func(next http.Handler) http.Handler {
		return (&httphandler.AuthMiddleware{Secret: jwtSecret}).Handler(next)
	}

	getMeUC := usecase.NewGetMe(userRepo)
	updateMeUC := usecase.NewUpdateMe(userRepo)
	mux.Handle("GET /api/v1/users/me", authWrap(httphandler.NewGetMeHandler(getMeUC)))
	mux.Handle("PATCH /api/v1/users/me", authWrap(httphandler.NewUpdateMeHandler(updateMeUC)))

	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	createCourseUC := usecase.NewCreateCourse(courseRepo, memberRepo)
	joinCourseUC := usecase.NewJoinCourse(courseRepo, memberRepo)
	listCoursesUC := usecase.NewListCourses(courseRepo, memberRepo)
	getCourseUC := usecase.NewGetCourse(courseRepo, memberRepo)
	getInviteCodeUC := usecase.NewGetInviteCode(courseRepo, memberRepo)
	regenerateInviteCodeUC := usecase.NewRegenerateInviteCode(courseRepo, memberRepo)
	deleteCourseUC := usecase.NewDeleteCourse(courseRepo, memberRepo)
	updateCourseUC := usecase.NewUpdateCourse(courseRepo, memberRepo)
	listCourseMembersUC := usecase.NewListCourseMembers(memberRepo, userRepo)
	assignTeacherUC := usecase.NewAssignTeacher(memberRepo)

	postRepo := memory.NewPostRepository()
	materialRepo := memory.NewMaterialRepository()
	assignmentRepo := memory.NewAssignmentRepository()
	submissionRepo := memory.NewSubmissionRepository()
	commentRepo := memory.NewCommentRepository()

	createPostUC := usecase.NewCreatePost(memberRepo, postRepo)
	createMaterialUC := usecase.NewCreateMaterial(memberRepo, materialRepo)
	createAssignmentUC := usecase.NewCreateAssignment(memberRepo, assignmentRepo)
	getAssignmentUC := usecase.NewGetAssignment(memberRepo, assignmentRepo)
	getCourseFeedUC := usecase.NewGetCourseFeed(memberRepo, postRepo, materialRepo, assignmentRepo)
	createSubmissionUC := usecase.NewCreateSubmission(memberRepo, assignmentRepo, submissionRepo)
	listSubmissionsUC := usecase.NewListSubmissions(memberRepo, assignmentRepo, submissionRepo)
	gradeSubmissionUC := usecase.NewGradeSubmission(memberRepo, assignmentRepo, submissionRepo)
	getStudentGradesUC := usecase.NewGetStudentGrades(memberRepo, assignmentRepo, submissionRepo)
	listCommentsUC := usecase.NewListComments(memberRepo, assignmentRepo, commentRepo)
	createCommentUC := usecase.NewCreateComment(memberRepo, assignmentRepo, commentRepo)

	coursesHandler := httphandler.NewCoursesHandler(
		httphandler.NewListCoursesHandler(listCoursesUC),
		httphandler.NewCreateCourseHandler(createCourseUC),
	)
	mux.Handle("/api/v1/courses", authWrap(coursesHandler))
	mux.Handle("POST /api/v1/courses/join", authWrap(httphandler.NewJoinCourseHandler(joinCourseUC)))
	mux.Handle("GET /api/v1/courses/{courseId}", authWrap(httphandler.NewGetCourseHandler(getCourseUC)))
	mux.Handle("PATCH /api/v1/courses/{courseId}", authWrap(httphandler.NewUpdateCourseHandler(updateCourseUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}", authWrap(httphandler.NewDeleteCourseHandler(deleteCourseUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/invite-code", authWrap(httphandler.NewGetInviteCodeHandler(getInviteCodeUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/invite-code", authWrap(httphandler.NewRegenerateInviteCodeHandler(regenerateInviteCodeUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/members", authWrap(httphandler.NewListCourseMembersHandler(listCourseMembersUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/members", authWrap(httphandler.NewAssignTeacherHandler(assignTeacherUC, userRepo)))
	mux.Handle("GET /api/v1/courses/{courseId}/feed", authWrap(httphandler.NewGetCourseFeedHandler(getCourseFeedUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/posts", authWrap(httphandler.NewCreatePostHandler(createPostUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/materials", authWrap(httphandler.NewCreateMaterialHandler(createMaterialUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments", authWrap(httphandler.NewCreateAssignmentHandler(createAssignmentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}", authWrap(httphandler.NewGetAssignmentHandler(getAssignmentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions", authWrap(httphandler.NewListSubmissionsHandler(listSubmissionsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions", authWrap(httphandler.NewCreateSubmissionHandler(createSubmissionUC)))
	mux.Handle("PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/grade", authWrap(httphandler.NewGradeSubmissionHandler(gradeSubmissionUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/members/{userId}/grades", authWrap(httphandler.NewGetStudentGradesHandler(getStudentGradesUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/comments", authWrap(httphandler.NewListCommentsHandler(listCommentsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/comments", authWrap(httphandler.NewCreateCommentHandler(createCommentUC)))

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

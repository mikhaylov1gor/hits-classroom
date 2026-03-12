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

	checkEmailUC := usecase.NewCheckEmailExists(userRepo)
	getMeUC := usecase.NewGetMe(userRepo)
	updateMeUC := usecase.NewUpdateMe(userRepo)
	mux.Handle("GET /api/v1/users/check-email", authWrap(httphandler.NewCheckEmailHandler(checkEmailUC)))
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
	inviteTeacherUC := usecase.NewInviteTeacher(memberRepo, userRepo)
	leaveCourseUC := usecase.NewLeaveCourse(memberRepo)
	removeMemberUC := usecase.NewRemoveMember(memberRepo)
	changeMemberRoleUC := usecase.NewChangeMemberRole(memberRepo)

	postRepo := memory.NewPostRepository()
	materialRepo := memory.NewMaterialRepository()
	assignmentRepo := memory.NewAssignmentRepository()
	submissionRepo := memory.NewSubmissionRepository()
	commentRepo := memory.NewCommentRepository()
	fileRepo := memory.NewFileRepository()

	createPostUC := usecase.NewCreatePost(memberRepo, postRepo)
	getPostUC := usecase.NewGetPost(memberRepo, postRepo)
	deletePostUC := usecase.NewDeletePost(memberRepo, postRepo, commentRepo)
	createMaterialUC := usecase.NewCreateMaterial(memberRepo, materialRepo)
	getMaterialUC := usecase.NewGetMaterial(memberRepo, materialRepo)
	deleteMaterialUC := usecase.NewDeleteMaterial(memberRepo, materialRepo, commentRepo)
	createAssignmentUC := usecase.NewCreateAssignment(memberRepo, assignmentRepo)
	getAssignmentUC := usecase.NewGetAssignment(memberRepo, assignmentRepo)
	deleteAssignmentUC := usecase.NewDeleteAssignment(memberRepo, assignmentRepo, submissionRepo, commentRepo)
	getCourseFeedUC := usecase.NewGetCourseFeed(memberRepo, postRepo, materialRepo, assignmentRepo)
	createSubmissionUC := usecase.NewCreateSubmission(memberRepo, assignmentRepo, submissionRepo)
	listSubmissionsUC := usecase.NewListSubmissions(memberRepo, assignmentRepo, submissionRepo)
	getMySubmissionUC := usecase.NewGetMySubmission(memberRepo, assignmentRepo, submissionRepo)
	gradeSubmissionUC := usecase.NewGradeSubmission(memberRepo, assignmentRepo, submissionRepo)
	detachAssignmentUC := usecase.NewDetachSubmission(memberRepo, assignmentRepo, submissionRepo)
	returnAssignmentUC := usecase.NewReturnAssignment(memberRepo, assignmentRepo, submissionRepo)
	getStudentGradesUC := usecase.NewGetStudentGrades(memberRepo, assignmentRepo, submissionRepo)
	listCommentsUC := usecase.NewListComments(memberRepo, assignmentRepo, commentRepo)
	createCommentUC := usecase.NewCreateComment(memberRepo, assignmentRepo, postRepo, materialRepo, commentRepo)
	listPostCommentsUC := usecase.NewListPostComments(memberRepo, postRepo, commentRepo)
	listMaterialCommentsUC := usecase.NewListMaterialComments(memberRepo, materialRepo, commentRepo)
	deleteCommentUC := usecase.NewDeleteComment(memberRepo, commentRepo)
	uploadFileUC := usecase.NewUploadFile(fileRepo)
	listUserFilesUC := usecase.NewListUserFiles(fileRepo)
	getFileUC := usecase.NewGetFile(fileRepo)

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
	mux.Handle("DELETE /api/v1/courses/{courseId}/members/{userId}", authWrap(httphandler.NewRemoveMemberHandler(removeMemberUC, userRepo)))
	mux.Handle("PATCH /api/v1/courses/{courseId}/members/{userId}/role", authWrap(httphandler.NewChangeMemberRoleHandler(changeMemberRoleUC, userRepo)))
	mux.Handle("POST /api/v1/courses/{courseId}/invite-teacher", authWrap(httphandler.NewInviteTeacherHandler(inviteTeacherUC, userRepo)))
	mux.Handle("POST /api/v1/courses/{courseId}/leave", authWrap(httphandler.NewLeaveCourseHandler(leaveCourseUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/feed", authWrap(httphandler.NewGetCourseFeedHandler(getCourseFeedUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/posts/{postId}", authWrap(httphandler.NewGetPostHandler(getPostUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/posts/{postId}", authWrap(httphandler.NewDeletePostHandler(deletePostUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/posts", authWrap(httphandler.NewCreatePostHandler(createPostUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/materials/{materialId}", authWrap(httphandler.NewGetMaterialHandler(getMaterialUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/materials/{materialId}", authWrap(httphandler.NewDeleteMaterialHandler(deleteMaterialUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/materials", authWrap(httphandler.NewCreateMaterialHandler(createMaterialUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}", authWrap(httphandler.NewGetAssignmentHandler(getAssignmentUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}", authWrap(httphandler.NewDeleteAssignmentHandler(deleteAssignmentUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments", authWrap(httphandler.NewCreateAssignmentHandler(createAssignmentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions", authWrap(httphandler.NewListSubmissionsHandler(listSubmissionsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions", authWrap(httphandler.NewCreateSubmissionHandler(createSubmissionUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/my", authWrap(httphandler.NewGetMySubmissionHandler(getMySubmissionUC)))
	mux.Handle("PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/grade", authWrap(httphandler.NewGradeSubmissionHandler(gradeSubmissionUC)))
	mux.Handle("PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/detach", authWrap(httphandler.NewDetachAssignmentHandler(detachAssignmentUC)))
	mux.Handle("PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/return", authWrap(httphandler.NewReturnAssignmentHandler(returnAssignmentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/members/{userId}/grades", authWrap(httphandler.NewGetStudentGradesHandler(getStudentGradesUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/comments", authWrap(httphandler.NewListCommentsHandler(listCommentsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/comments", authWrap(httphandler.NewCreateCommentHandler(createCommentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/posts/{postId}/comments", authWrap(httphandler.NewListPostCommentsHandler(listPostCommentsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/posts/{postId}/comments", authWrap(httphandler.NewCreatePostCommentHandler(createCommentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/materials/{materialId}/comments", authWrap(httphandler.NewListMaterialCommentsHandler(listMaterialCommentsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/materials/{materialId}/comments", authWrap(httphandler.NewCreateMaterialCommentHandler(createCommentUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/comments/{commentId}", authWrap(httphandler.NewDeleteCommentHandler(deleteCommentUC)))

	mux.Handle("POST /api/v1/files", authWrap(httphandler.NewUploadFileHandler(uploadFileUC)))
	mux.Handle("GET /api/v1/users/{userId}/files", authWrap(httphandler.NewListUserFilesHandler(listUserFilesUC)))
	mux.Handle("GET /api/v1/files/{fileId}", authWrap(httphandler.NewGetFileHandler(getFileUC)))

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

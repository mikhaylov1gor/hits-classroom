package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"hits-classroom/internal/repository/gormrepo"
	httphandler "hits-classroom/internal/transport/http"
	"hits-classroom/internal/usecase"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/health", httphandler.NewHealthHandler())

	jwtSecret := []byte("dev-secret-change-in-production")
	jwtIssuer := &usecase.JWTIssuer{Secret: jwtSecret, Expiry: 24 * time.Hour}
	db, err := gormrepo.OpenFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	if err := gormrepo.AutoMigrate(db); err != nil {
		log.Fatal(err)
	}
	if os.Getenv("SEED_DEMO_DATA") != "false" {
		if err := gormrepo.SeedDemoData(db); err != nil {
			log.Fatal(err)
		}
		log.Println("demo seed data loaded")
	}
	userRepo := gormrepo.NewUserRepository(db)
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

	courseRepo := gormrepo.NewCourseRepository(db)
	memberRepo := gormrepo.NewCourseMemberRepository(db)
	createCourseUC := usecase.NewCreateCourse(courseRepo, memberRepo)
	joinCourseUC := usecase.NewJoinCourse(courseRepo, memberRepo)
	listCoursesUC := usecase.NewListCourses(courseRepo, memberRepo)
	getCourseUC := usecase.NewGetCourse(courseRepo, memberRepo)
	getInviteCodeUC := usecase.NewGetInviteCode(courseRepo, memberRepo)
	regenerateInviteCodeUC := usecase.NewRegenerateInviteCode(courseRepo, memberRepo)
	deleteCourseUC := usecase.NewDeleteCourse(courseRepo, memberRepo)
	updateCourseUC := usecase.NewUpdateCourse(courseRepo, memberRepo)
	listCourseMembersUC := usecase.NewListCourseMembers(memberRepo, userRepo)
	listJoinRequestsUC := usecase.NewListJoinRequests(memberRepo, userRepo)
	decideJoinRequestUC := usecase.NewDecideJoinRequest(memberRepo)
	assignTeacherUC := usecase.NewAssignTeacher(memberRepo)
	inviteTeacherUC := usecase.NewInviteTeacher(memberRepo, userRepo)
	acceptCourseInviteUC := usecase.NewAcceptCourseInvitation(memberRepo)
	leaveCourseUC := usecase.NewLeaveCourse(memberRepo)
	removeMemberUC := usecase.NewRemoveMember(memberRepo)
	changeMemberRoleUC := usecase.NewChangeMemberRole(memberRepo)

	postRepo := gormrepo.NewPostRepository(db)
	materialRepo := gormrepo.NewMaterialRepository(db)
	assignmentRepo := gormrepo.NewAssignmentRepository(db)
	submissionRepo := gormrepo.NewSubmissionRepository(db)
	commentRepo := gormrepo.NewCommentRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	teamRepo := gormrepo.NewTeamRepository(db)
	teamMemberRepo := gormrepo.NewTeamMemberRepository(db)
	teamVoteRepo := gormrepo.NewTeamVoteRepository(db)
	teamLikeRepo := gormrepo.NewTeamSubmissionLikeRepository(db)

	createPostUC := usecase.NewCreatePost(memberRepo, postRepo)
	getPostUC := usecase.NewGetPost(memberRepo, postRepo)
	deletePostUC := usecase.NewDeletePost(memberRepo, postRepo, commentRepo)
	createMaterialUC := usecase.NewCreateMaterial(memberRepo, materialRepo)
	getMaterialUC := usecase.NewGetMaterial(memberRepo, materialRepo)
	deleteMaterialUC := usecase.NewDeleteMaterial(memberRepo, materialRepo, commentRepo)
	createAssignmentUC := usecase.NewCreateAssignment(memberRepo, assignmentRepo)
	updateAssignmentUC := usecase.NewUpdateAssignment(memberRepo, assignmentRepo, teamRepo, teamMemberRepo)
	getAssignmentUC := usecase.NewGetAssignment(memberRepo, assignmentRepo)
	teamPeerGradeRepo := gormrepo.NewTeamPeerGradeRepository(db)
	teamAuditRepo := gormrepo.NewTeamAuditRepository(db)

	deleteAssignmentUC := usecase.NewDeleteAssignment(memberRepo, assignmentRepo, submissionRepo, commentRepo, teamRepo, teamMemberRepo, teamVoteRepo, teamPeerGradeRepo, teamAuditRepo)
	getCourseFeedUC := usecase.NewGetCourseFeed(memberRepo, postRepo, materialRepo, assignmentRepo)
	createSubmissionUC := usecase.NewCreateSubmission(memberRepo, assignmentRepo, submissionRepo, teamMemberRepo)
	listSubmissionsUC := usecase.NewListSubmissions(memberRepo, assignmentRepo, submissionRepo)
	getMySubmissionUC := usecase.NewGetMySubmission(memberRepo, assignmentRepo, submissionRepo)
	gradeSubmissionUC := usecase.NewGradeSubmission(memberRepo, assignmentRepo, submissionRepo, teamMemberRepo, teamAuditRepo)
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
	getFileInfoUC := usecase.NewGetFileInfo(fileRepo)
	listAssignmentTeamsUC := usecase.NewListAssignmentTeams(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, teamVoteRepo, userRepo)
	saveManualTeamsUC := usecase.NewSaveManualTeams(memberRepo, assignmentRepo, teamRepo, teamAuditRepo)
	generateRandomTeamsUC := usecase.NewGenerateRandomTeams(memberRepo, assignmentRepo, teamRepo, teamAuditRepo)
	generateBalancedTeamsUC := usecase.NewGenerateBalancedTeams(memberRepo, assignmentRepo, teamRepo, submissionRepo, teamAuditRepo)
	createTeamUC := usecase.NewCreateTeam(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, teamAuditRepo)
	joinTeamUC := usecase.NewJoinTeam(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, teamAuditRepo)
	leaveTeamUC := usecase.NewLeaveTeam(memberRepo, assignmentRepo, teamMemberRepo, teamAuditRepo)
	deleteTeamUC := usecase.NewDeleteTeam(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, teamAuditRepo)
	voteTeamSubmissionUC := usecase.NewVoteTeamSubmission(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, teamVoteRepo, teamAuditRepo)
	finalizeTeamVoteUC := usecase.NewFinalizeTeamVoteSubmission(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, teamVoteRepo, teamLikeRepo, teamAuditRepo)
	listTeamSubmissionsForVoteUC := usecase.NewListTeamSubmissionsForVote(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, teamVoteRepo, teamLikeRepo)
	toggleSubmissionLikeUC := usecase.NewToggleSubmissionLike(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, teamLikeRepo, teamAuditRepo)
	lockTeamRosterUC := usecase.NewLockTeamRoster(memberRepo, assignmentRepo, teamAuditRepo)
	listTeamAuditUC := usecase.NewListTeamAudit(memberRepo, teamAuditRepo)
	submitPeerGradeSplitUC := usecase.NewSubmitPeerGradeSplit(memberRepo, assignmentRepo, teamRepo, teamMemberRepo, teamPeerGradeRepo, teamAuditRepo)
	gradeTeamPeerSplitUC := usecase.NewGradeTeamPeerSplit(memberRepo, assignmentRepo, teamRepo, submissionRepo, teamMemberRepo, teamPeerGradeRepo, teamAuditRepo)
	autoFinalizeUC := usecase.NewAutoFinalizeDeadline(assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, finalizeTeamVoteUC, teamAuditRepo)
	autoLockFormationUC := usecase.NewAutoLockTeamFormation(assignmentRepo, teamAuditRepo)
	finalizeTeamSubmissionsNowUC := usecase.NewFinalizeTeamSubmissionsNow(memberRepo, assignmentRepo, autoFinalizeUC)

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
	mux.Handle("GET /api/v1/courses/{courseId}/join-requests", authWrap(httphandler.NewListJoinRequestsHandler(listJoinRequestsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/join-requests/{userId}/{action}", authWrap(httphandler.NewDecideJoinRequestHandler(decideJoinRequestUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/members", authWrap(httphandler.NewAssignTeacherHandler(assignTeacherUC, userRepo)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/members/{userId}", authWrap(httphandler.NewRemoveMemberHandler(removeMemberUC, userRepo)))
	mux.Handle("PATCH /api/v1/courses/{courseId}/members/{userId}/role", authWrap(httphandler.NewChangeMemberRoleHandler(changeMemberRoleUC, userRepo)))
	mux.Handle("POST /api/v1/courses/{courseId}/invite-teacher", authWrap(httphandler.NewInviteTeacherHandler(inviteTeacherUC, userRepo)))
	mux.Handle("POST /api/v1/courses/{courseId}/invitations/accept", authWrap(httphandler.NewAcceptCourseInvitationHandler(acceptCourseInviteUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/leave", authWrap(httphandler.NewLeaveCourseHandler(leaveCourseUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/feed", authWrap(httphandler.NewGetCourseFeedHandler(getCourseFeedUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/posts/{postId}", authWrap(httphandler.NewGetPostHandler(getPostUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/posts/{postId}", authWrap(httphandler.NewDeletePostHandler(deletePostUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/posts", authWrap(httphandler.NewCreatePostHandler(createPostUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/materials/{materialId}", authWrap(httphandler.NewGetMaterialHandler(getMaterialUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/materials/{materialId}", authWrap(httphandler.NewDeleteMaterialHandler(deleteMaterialUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/materials", authWrap(httphandler.NewCreateMaterialHandler(createMaterialUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}", authWrap(httphandler.NewGetAssignmentHandler(getAssignmentUC)))
	mux.Handle("PATCH /api/v1/courses/{courseId}/assignments/{assignmentId}", authWrap(httphandler.NewUpdateAssignmentHandler(updateAssignmentUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}", authWrap(httphandler.NewDeleteAssignmentHandler(deleteAssignmentUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments", authWrap(httphandler.NewCreateAssignmentHandler(createAssignmentUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions", authWrap(httphandler.NewListSubmissionsHandler(listSubmissionsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions", authWrap(httphandler.NewCreateSubmissionHandler(createSubmissionUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/my", authWrap(httphandler.NewGetMySubmissionHandler(getMySubmissionUC)))
	mux.Handle("PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/grade", authWrap(httphandler.NewGradeSubmissionHandler(gradeSubmissionUC)))
	mux.Handle("PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/team-members/{userId}/grade", authWrap(httphandler.NewGradeTeamMemberSubmissionHandler(gradeSubmissionUC)))
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
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/teams", authWrap(httphandler.NewListAssignmentTeamsHandler(listAssignmentTeamsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/save", authWrap(httphandler.NewSaveManualTeamsHandler(saveManualTeamsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/generate-random", authWrap(httphandler.NewGenerateRandomTeamsHandler(generateRandomTeamsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/generate-balanced", authWrap(httphandler.NewGenerateBalancedTeamsHandler(generateBalancedTeamsUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams", authWrap(httphandler.NewCreateTeamHandler(createTeamUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/join", authWrap(httphandler.NewJoinTeamHandler(joinTeamUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/leave", authWrap(httphandler.NewLeaveTeamHandler(leaveTeamUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/leave", authWrap(httphandler.NewLeaveTeamHandler(leaveTeamUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}", authWrap(httphandler.NewDeleteTeamHandler(deleteTeamUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/votes", authWrap(httphandler.NewVoteTeamSubmissionHandler(voteTeamSubmissionUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/submissions", authWrap(httphandler.NewListTeamSubmissionsForVoteHandler(listTeamSubmissionsForVoteUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/submissions/{submissionId}/like", authWrap(httphandler.NewToggleSubmissionLikeHandler(toggleSubmissionLikeUC)))
	mux.Handle("DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/submissions/{submissionId}/like", authWrap(httphandler.NewToggleSubmissionLikeHandler(toggleSubmissionLikeUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/finalize-vote", authWrap(httphandler.NewFinalizeTeamVoteSubmissionHandler(finalizeTeamVoteUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/lock-roster", authWrap(httphandler.NewLockTeamRosterHandler(lockTeamRosterUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/finalize-submissions", authWrap(httphandler.NewFinalizeTeamSubmissionsNowHandler(finalizeTeamSubmissionsNowUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/audit", authWrap(httphandler.NewListTeamAuditHandler(listTeamAuditUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/peer-grade-split", authWrap(httphandler.NewSubmitPeerGradeSplitHandler(submitPeerGradeSplitUC)))
	mux.Handle("POST /api/v1/courses/{courseId}/assignments/{assignmentId}/teams/{teamId}/grade-peer-split", authWrap(httphandler.NewGradeTeamPeerSplitHandler(gradeTeamPeerSplitUC)))

	go func() {
		t := time.NewTicker(1 * time.Minute)
		defer t.Stop()
		for range t.C {
			now := time.Now().UTC()
			_ = autoLockFormationUC.Run(now)
			_ = autoFinalizeUC.Run(now)
		}
	}()

	getSubmissionFileUC := usecase.NewGetSubmissionFile(memberRepo, assignmentRepo, submissionRepo, fileRepo)
	getPostFileUC := usecase.NewGetPostFile(memberRepo, postRepo, fileRepo)
	getMaterialFileUC := usecase.NewGetMaterialFile(memberRepo, materialRepo, fileRepo)

	mux.Handle("POST /api/v1/files", authWrap(httphandler.NewUploadFileHandler(uploadFileUC)))
	mux.Handle("GET /api/v1/users/{userId}/files", authWrap(httphandler.NewListUserFilesHandler(listUserFilesUC)))
	mux.Handle("GET /api/v1/files/{fileId}", authWrap(httphandler.NewGetFileHandler(getFileUC)))
	mux.Handle("GET /api/v1/files/{fileId}/info", authWrap(httphandler.NewGetFileInfoHandler(getFileInfoUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/files/{fileId}", authWrap(httphandler.NewGetSubmissionFileHandler(getSubmissionFileUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/posts/{postId}/files/{fileId}", authWrap(httphandler.NewGetPostFileHandler(getPostFileUC)))
	mux.Handle("GET /api/v1/courses/{courseId}/materials/{materialId}/files/{fileId}", authWrap(httphandler.NewGetMaterialFileHandler(getMaterialFileUC)))

	log.Println("server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

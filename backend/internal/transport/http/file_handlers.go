package http

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"strconv"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/usecase"
)

type GetFileHandler struct {
	getFile *usecase.GetFile
}

func NewGetFileHandler(getFile *usecase.GetFile) *GetFileHandler {
	return &GetFileHandler{getFile: getFile}
}

func (h *GetFileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	fileID := r.PathValue("fileId")
	if fileID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	f, data, err := h.getFile.GetFile(usecase.GetFileInput{FileID: fileID, UserID: userID})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", f.MimeType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+f.FileName+"\"")
	w.Header().Set("Content-Length", strconv.FormatInt(f.FileSize, 10))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func fileResponse(f *domain.File) map[string]interface{} {
	if f == nil {
		return nil
	}
	return map[string]interface{}{
		"id":         f.ID,
		"user_id":    f.UserID,
		"file_name":  f.FileName,
		"file_size":  f.FileSize,
		"mime_type":  f.MimeType,
		"created_at": f.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

type UploadFileHandler struct {
	uploadFile *usecase.UploadFile
}

func NewUploadFileHandler(uploadFile *usecase.UploadFile) *UploadFileHandler {
	return &UploadFileHandler{uploadFile: uploadFile}
}

func (h *UploadFileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	const maxFileSize = 50 * 1024 * 1024 // 50 MB
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid multipart form"})
		return
	}
	file, handler, err := r.FormFile("file")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "file is required"})
		return
	}
	defer file.Close()

	// Читаем содержимое файла
	fileData, err := ioutil.ReadAll(file)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "failed to read file"})
		return
	}

	f, err := h.uploadFile.UploadFile(usecase.UploadFileInput{
		UserID:   userID,
		FileName: handler.Filename,
		FileSize: handler.Size,
		MimeType: handler.Header.Get("Content-Type"),
		FileData: fileData,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(fileResponse(f))
}

type ListUserFilesHandler struct {
	listUserFiles *usecase.ListUserFiles
}

func NewListUserFilesHandler(listUserFiles *usecase.ListUserFiles) *ListUserFilesHandler {
	return &ListUserFilesHandler{listUserFiles: listUserFiles}
}

func (h *ListUserFilesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	targetUserID := r.PathValue("userId")
	if targetUserID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	files, err := h.listUserFiles.ListUserFiles(usecase.ListUserFilesInput{UserID: targetUserID})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	out := make([]map[string]interface{}, 0, len(files))
	for _, f := range files {
		out = append(out, fileResponse(f))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type GetSubmissionFileHandler struct {
	getSubmissionFile *usecase.GetSubmissionFile
}

func NewGetSubmissionFileHandler(uc *usecase.GetSubmissionFile) *GetSubmissionFileHandler {
	return &GetSubmissionFileHandler{getSubmissionFile: uc}
}

func (h *GetSubmissionFileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	assignmentID := r.PathValue("assignmentId")
	submissionID := r.PathValue("submissionId")
	fileID := r.PathValue("fileId")
	if courseID == "" || assignmentID == "" || submissionID == "" || fileID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	f, data, err := h.getSubmissionFile.GetSubmissionFile(usecase.GetSubmissionFileInput{
		CourseID:     courseID,
		AssignmentID: assignmentID,
		SubmissionID: submissionID,
		FileID:       fileID,
		RequesterID:  userID,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
			return
		}
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", f.MimeType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+f.FileName+"\"")
	w.Header().Set("Content-Length", strconv.FormatInt(f.FileSize, 10))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

type GetFileInfoHandler struct {
	getFileInfo *usecase.GetFileInfo
}

func NewGetFileInfoHandler(getFileInfo *usecase.GetFileInfo) *GetFileInfoHandler {
	return &GetFileInfoHandler{getFileInfo: getFileInfo}
}

func (h *GetFileInfoHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	fileID := r.PathValue("fileId")
	if fileID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	f, err := h.getFileInfo.GetFileInfo(usecase.GetFileInfoInput{FileID: fileID, UserID: userID})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(fileResponse(f))
}

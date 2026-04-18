export type CourseRole = 'student' | 'teacher' | 'owner'

export type CourseMemberStatus = 'pending' | 'approved' | 'rejected'

export type CourseWithRole = {
  id: string
  title: string
  role: CourseRole
  invite_code?: string
  membership_status?: CourseMemberStatus
}

export type CourseTabId = 'assignments' | 'posts' | 'materials' | 'users' | 'settings'

export type FeedItemType = 'post' | 'material' | 'assignment'

export type FeedItem = {
  type: FeedItemType
  id: string
  title: string
  body?: string | null
  created_at?: string
  deadline?: string | null
  user_id?: string | null
  author?: { first_name: string; last_name: string } | null
  attachments?: { id: string; name: string; type?: string; url?: string }[] | null
  file_ids?: string[]
  assignment_kind?: AssignmentKind | null
}

export type Post = {
  id: string
  course_id: string
  user_id?: string
  title: string
  body?: string | null
  links?: string[]
  file_ids?: string[]
  created_at?: string
  author?: { first_name: string; last_name: string } | null
  attachments?: { id: string; name: string; type?: string; url?: string }[] | null
}

export type Comment = {
  id: string
  assignment_id?: string
  post_id?: string
  material_id?: string
  user_id: string
  parent_id?: string | null
  is_private?: boolean
  reply_to_user_id?: string | null
  body?: string | null
  file_ids?: string[]
  created_at?: string
  author?: { first_name: string; last_name: string } | null
  replies?: Comment[]
}

export function countCommentsRecursively(comments: Comment[]): number {
  return comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ? countCommentsRecursively(c.replies) : 0),
    0,
  )
}

export function flattenComments(comments: Comment[]): Comment[] {
  return comments.flatMap((c) => [c, ...(c.replies ? flattenComments(c.replies) : [])])
}

/** Строит дерево комментариев из плоского списка по parent_id */
export function buildCommentTree(comments: Comment[]): Comment[] {
  const flat = flattenComments(comments)
  const seen = new Set<string>()
  const uniqueFlat = flat.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
  const byId = new Map<string, Comment & { replies?: Comment[] }>()
  uniqueFlat.forEach((c) => byId.set(c.id, { ...c, replies: [] }))
  const roots: Comment[] = []
  uniqueFlat.forEach((c) => {
    const node = byId.get(c.id)!
    if (!c.parent_id) {
      roots.push(node)
    } else {
      const parent = byId.get(c.parent_id)
      if (parent) {
        parent.replies = parent.replies ?? []
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    }
  })
  const sortByDate = (a: Comment, b: Comment) =>
    new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  roots.sort(sortByDate)
  const sortReplies = (nodes: Comment[]) => {
    nodes.forEach((n) => {
      if (n.replies?.length) sortReplies(n.replies)
    })
    nodes.sort(sortByDate)
  }
  sortReplies(roots)
  return roots
}

function filterPrivateFromTree(comments: Comment[]): Comment[] {
  return comments
    .filter((c) => !c.is_private)
    .map((c) => ({
      ...c,
      replies: c.replies ? filterPrivateFromTree(c.replies) : undefined,
    }))
}

export function getGeneralComments(comments: Comment[]): Comment[] {
  const roots = comments.filter((c) => !c.is_private)
  return filterPrivateFromTree(roots)
}

/** Проверка, что комментарий в личной ветке студент–преподаватель */
function passesStudentPrivateFilter(
  c: Comment,
  authUserId: string | undefined,
  teacherIds: string[],
): boolean {
  if (!authUserId) return false
  return !!(c.is_private && (c.user_id === authUserId || teacherIds.includes(c.user_id)))
}

/** Личные комментарии студента (диалог с преподавателем). Включает всю ветку целиком. */
export function filterStudentComments(
  comments: Comment[],
  authUserId: string | undefined,
  teacherIds: string[],
): Comment[] {
  if (!authUserId) return []
  const flat = flattenComments(comments)
  const kept = new Set<string>()
  // Корни, проходящие фильтр
  flat.forEach((c) => {
    if (!c.parent_id && passesStudentPrivateFilter(c, authUserId, teacherIds)) kept.add(c.id)
  })
  // Любые комментарии, проходящие фильтр (в т.ч. ответы)
  flat.forEach((c) => {
    if (passesStudentPrivateFilter(c, authUserId, teacherIds)) kept.add(c.id)
  })
  // Все потомки уже в kept (вся ветка)
  let changed = true
  while (changed) {
    changed = false
    flat.forEach((c) => {
      if (c.parent_id && kept.has(c.parent_id) && !kept.has(c.id)) {
        kept.add(c.id)
        changed = true
      }
    })
  }
  return flat.filter((c) => kept.has(c.id))
}

/** Проверка, что комментарий в личной ветке преподаватель–студент */
function passesTeacherDialogFilter(
  c: Comment,
  authUserId: string | undefined,
  studentId: string,
): boolean {
  if (!authUserId) return false
  return !!(c.is_private && (c.user_id === studentId || c.user_id === authUserId))
}

/** Личные комментарии преподавателя в диалоге со студентом. Включает всю ветку целиком. */
export function filterTeacherDialogComments(
  comments: Comment[],
  authUserId: string | undefined,
  studentId: string,
): Comment[] {
  if (!authUserId) return []
  const flat = flattenComments(comments)
  const kept = new Set<string>()
  flat.forEach((c) => {
    if (!c.parent_id && passesTeacherDialogFilter(c, authUserId, studentId)) kept.add(c.id)
  })
  flat.forEach((c) => {
    if (passesTeacherDialogFilter(c, authUserId, studentId)) kept.add(c.id)
  })
  let changed = true
  while (changed) {
    changed = false
    flat.forEach((c) => {
      if (c.parent_id && kept.has(c.parent_id) && !kept.has(c.id)) {
        kept.add(c.id)
        changed = true
      }
    })
  }
  return flat.filter((c) => kept.has(c.id))
}

/** Дерево личных комментариев для студента */
export function getPersonalCommentsTreeForStudent(
  comments: Comment[],
  authUserId: string | undefined,
  teacherIds: string[],
): Comment[] {
  const flat = filterStudentComments(comments, authUserId, teacherIds)
  return buildCommentTree(flat)
}

/** Дерево личных комментариев для диалога преподаватель–студент */
export function getPersonalCommentsTreeForTeacher(
  comments: Comment[],
  authUserId: string | undefined,
  studentId: string,
): Comment[] {
  const flat = filterTeacherDialogComments(comments, authUserId, studentId)
  return buildCommentTree(flat)
}

export type Member = {
  user_id: string
  email: string
  first_name: string
  last_name: string
  role: CourseRole
  birth_date?: string | null
  status?: CourseMemberStatus
  requested_at?: string
  decided_at?: string | null
  decided_by?: string | null
  decision_note?: string | null
}

type MemberLike = {
  user_id: string
  first_name?: string
  last_name?: string
}

export function getNameByUserId(
  members: MemberLike[],
  userId: string,
  fallback?: { first_name?: string; last_name?: string } | null,
): string {
  const m = members.find((x) => x.user_id === userId)
  if (m) {
    const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
    return name || 'Участник'
  }
  if (fallback && (fallback.first_name || fallback.last_name)) {
    return `${fallback.first_name ?? ''} ${fallback.last_name ?? ''}`.trim()
  }
  return 'Участник'
}

/** ФИО создателя команды: из состава команды или из списка участников курса */
export function getTeamCreatorDisplayName(
  team: {
    creator_id: string
    members: { user_id: string; first_name: string; last_name: string }[]
  },
  courseMembers: MemberLike[],
): string {
  const inTeam = team.members.find((m) => m.user_id === team.creator_id)
  if (inTeam) {
    const name = `${inTeam.first_name ?? ''} ${inTeam.last_name ?? ''}`.trim()
    if (name) return name
  }
  return getNameByUserId(courseMembers, team.creator_id)
}

export function getInitialsFromMember(
  members: MemberLike[],
  userId: string,
  fallback?: { first_name?: string; last_name?: string } | null,
): string {
  const m = members.find((x) => x.user_id === userId)
  if (m) return getMemberInitials(m)
  if (fallback && (fallback.first_name || fallback.last_name)) {
    const f = (fallback.first_name ?? '').trim().charAt(0)
    const l = (fallback.last_name ?? '').trim().charAt(0)
    return (f + l).toUpperCase() || '?'
  }
  return '?'
}

export function getMemberInitials(m: MemberLike & { email?: string }): string {
  const f = (m.first_name ?? '').trim().charAt(0)
  const l = (m.last_name ?? '').trim().charAt(0)
  return (f + l).toUpperCase() || m.email?.[0]?.toUpperCase() || '?'
}

export type InviteCode = {
  code: string
}

export type AssignmentKind = 'individual' | 'group'

export type TeamDistributionType =
  | 'free'      // свободное вступление
  | 'random'    // рандомное распределение
  | 'balanced'  // распределение по баллам
  | 'manual'    // ручное распределение

export type TeamSubmissionRule =
  | 'first_submission'  // первое решение
  | 'last_submission'   // последнее решение
  | 'top_student_only'  // решение участника с наивысшим баллом
  | 'vote_equal'        // голосование (равные голоса)
  | 'vote_weighted'     // голосование (взвешенные голоса)

export type VoteTieBreak =
  | 'random'                  // случайный выбор
  | 'highest_author_average'  // победитель по среднему баллу автора

export type TeamGradingMode =
  | 'individual'      // обычная оценка по каждому ответу
  | 'team_uniform'    // одна оценка протягивается всей команде
  | 'team_peer_split' // студенты делят проценты, преподаватель - одну оценку

export type Assignment = {
  id: string
  course_id: string
  title: string
  body?: string | null
  links?: string[]
  file_ids?: string[]
  deadline?: string | null
  max_grade?: number
  created_at?: string
  user_id?: string | null
  author?: { first_name: string; last_name: string } | null
  // Тип задания
  assignment_kind?: AssignmentKind | null
  // Групповые поля (плоские, как возвращает API)
  desired_team_size?: number | null
  team_distribution_type?: TeamDistributionType | null
  team_count?: number | null
  max_team_size?: number | null
  team_submission_rule?: TeamSubmissionRule | null
  vote_tie_break?: VoteTieBreak | null
  allow_early_finalization?: boolean | null
  team_grading_mode?: TeamGradingMode | null
  peer_split_min_percent?: number | null
  peer_split_max_percent?: number | null
  roster_locked_at?: string | null
  deadline_auto_finalized_at?: string | null
}

export type TeamStatus =
  | 'forming'
  | 'roster_locked'
  | 'voting_open'
  | 'voting'
  | 'submitted'
  | 'graded'
  | 'not_submitted'

export type TeamMemberInfo = {
  user_id: string
  first_name: string
  last_name: string
  average_score: number
}

export type Team = {
  id: string
  assignment_id: string
  creator_id: string
  name: string
  max_members: number
  created_at: string
}

export type TeamWithMembers = Team & {
  members: TeamMemberInfo[]
  status: TeamStatus
}

export type TeamAuditEvent = {
  id: string
  assignment_id: string
  team_id: string
  actor_user_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export type SubmissionStatus = 'draft' | 'submitted' | 'returned'

export type Submission = {
  id: string
  assignment_id: string
  user_id: string
  body?: string | null
  file_ids?: string[]
  submitted_at?: string
  grade: number | null
  grade_comment?: string | null
  status?: SubmissionStatus | null
  /** false или отсутствует - черновик; true - сдача прикреплена к заданию */
  is_attached?: boolean | null
  /** true - задание вернули на доработку */
  is_returned?: boolean | null
  author?: { first_name: string; last_name: string } | null
}

/** Черновик: is_attached === false или отсутствует */
export function isSubmissionDraft(submission: Submission | null | undefined): boolean {
  if (!submission) return true
  return submission.is_attached !== true
}

/** Вернули на доработку: is_returned === true */
export function isSubmissionReturned(submission: Submission | null | undefined): boolean {
  if (!submission) return false
  return submission.is_returned === true || submission.status === 'returned'
}

export type SubmissionWithAssignment = {
  submission: {
    id: string
    assignment_id: string
    user_id: string
    grade: number | null
    submitted_at?: string
  }
  assignment: {
    id: string
    title: string
    deadline?: string | null
    max_grade?: number
  }
}

export type TeamSubmissionVoteStats = {
  submission_id: string
  vote_weight: number
  vote_count: number
  like_count: number
}

export type TeamSubmissionForVote = {
  submission: Submission
  stats: TeamSubmissionVoteStats
}

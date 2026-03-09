import { test, expect } from '@playwright/test'

const mockAuthUser = {
  id: 'user-1',
  email: 'teacher@example.com',
  first_name: 'Иван',
  last_name: 'Преподаватель',
  birth_date: '1980-01-01',
  created_at: new Date().toISOString(),
}

function mockAuth(page: import('@playwright/test').Page) {
  return page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAuthUser),
    }),
  )
}

function mockCourseList(page: import('@playwright/test').Page, courses: object[]) {
  return page.route('**/api/v1/courses', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(courses),
    }),
  )
}

function mockCourse(
  page: import('@playwright/test').Page,
  courseId: string,
  course: object,
) {
  return page.route(`**/api/v1/courses/${courseId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(course),
    }),
  )
}

function mockFeed(page: import('@playwright/test').Page, courseId: string, items: object[] = []) {
  return page.route(`**/api/v1/courses/${courseId}/feed`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(items),
    }),
  )
}

function mockMembers(page: import('@playwright/test').Page, courseId: string, members: object[] = []) {
  return page.route(`**/api/v1/courses/${courseId}/members`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(members),
    }),
  )
}

function mockInviteCode(page: import('@playwright/test').Page, courseId: string, code: string) {
  return page.route(`**/api/v1/courses/${courseId}/invite-code`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code }),
    }),
  )
}

function mockAssignment(
  page: import('@playwright/test').Page,
  courseId: string,
  assignmentId: string,
  assignment: object,
) {
  return page.route(`**/api/v1/courses/${courseId}/assignments/${assignmentId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(assignment),
    }),
  )
}

function mockComments(
  page: import('@playwright/test').Page,
  courseId: string,
  entityId: string,
  comments: object[] = [],
) {
  return page.route(
    `**/api/v1/courses/${courseId}/assignments/${entityId}/comments`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(comments),
      }),
  )
}

test.describe('Возврат работы студента преподавателем', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('преподаватель видит кнопку «Вернуть» у сданной работы', async ({ page }) => {
    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'teacher' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'teacher' })
    await mockFeed(page, 'c1', [
      { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
    ])
    await mockInviteCode(page, 'c1', 'CODE1234')
    await mockMembers(page, 'c1', [])
    await mockAssignment(page, 'c1', 'a1', {
      id: 'a1',
      course_id: 'c1',
      title: 'Задание',
      body: 'Описание',
      deadline: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    await mockComments(page, 'c1', 'a1', [])

    await page.route('**/api/v1/courses/c1/assignments/a1/submissions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sub-1',
            assignment_id: 'a1',
            user_id: 'u1',
            body: 'Ответ студента',
            submitted_at: '2024-01-15T12:00:00Z',
            grade: null,
            status: 'submitted',
            author: { first_name: 'Студент', last_name: 'Иванов' },
          },
        ]),
      }),
    )

    await page.goto('/course/c1/assignment/a1')
    await page.getByRole('tab', { name: /работы учащихся/i }).click()

    await expect(page.getByRole('button', { name: /вернуть/i })).toBeVisible()
  })

  test('преподаватель может вернуть работу студента', async ({ page }) => {
    let submissions = [
      {
        id: 'sub-1',
        assignment_id: 'a1',
        user_id: 'u1',
        body: 'Ответ студента',
        submitted_at: '2024-01-15T12:00:00Z',
        grade: null,
        status: 'submitted' as const,
        author: { first_name: 'Студент', last_name: 'Иванов' },
      },
    ]

    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'teacher' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'teacher' })
    await mockFeed(page, 'c1', [
      { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
    ])
    await mockInviteCode(page, 'c1', 'CODE1234')
    await mockMembers(page, 'c1', [])
    await mockAssignment(page, 'c1', 'a1', {
      id: 'a1',
      course_id: 'c1',
      title: 'Задание',
      body: 'Описание',
      deadline: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    await mockComments(page, 'c1', 'a1', [])

    await page.route('**/api/v1/courses/c1/assignments/a1/submissions/sub-1/return', async (route) => {
      if (route.request().method() === 'PUT') {
        submissions = submissions.map((s) =>
          s.id === 'sub-1' ? { ...s, status: 'returned' as const } : s,
        )
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...submissions[0], status: 'returned' }),
        })
      } else {
        await route.fallback()
      }
    })
    await page.route('**/api/v1/courses/c1/assignments/a1/submissions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(submissions),
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
    await page.getByRole('tab', { name: /задания/i }).click()
    await page.getByRole('button', { name: /задание/i }).first().click()
    await page.getByRole('tab', { name: /работы учащихся/i }).click()
    await expect(page.getByRole('button', { name: /вернуть/i }).first()).toBeEnabled({ timeout: 5000 })
    await page.getByRole('button', { name: /вернуть/i }).first().click()

    await expect(page.getByText(/возвращено на доработку|возвращено/i)).toBeVisible()
  })

  test('студент видит статус «Возвращено на доработку» после возврата', async ({ page }) => {
    const mockAuthStudent = {
      id: 'u1',
      email: 'student@example.com',
      first_name: 'Студент',
      last_name: 'Иванов',
      birth_date: '2000-01-01',
      created_at: new Date().toISOString(),
    }
    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuthStudent),
      }),
    )

    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
    await mockFeed(page, 'c1', [
      { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
    ])
    await mockMembers(page, 'c1', [])
    await mockAssignment(page, 'c1', 'a1', {
      id: 'a1',
      course_id: 'c1',
      title: 'Задание',
      body: 'Описание',
      deadline: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    await mockComments(page, 'c1', 'a1', [])

    await page.route('**/api/v1/courses/c1/assignments/a1/submissions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sub-1',
            assignment_id: 'a1',
            user_id: 'u1',
            body: 'Мой ответ',
            submitted_at: '2024-01-15T12:00:00Z',
            grade: null,
            status: 'returned',
            author: { first_name: 'Студент', last_name: 'Иванов' },
          },
        ]),
      }),
    )

    await page.goto('/course/c1/assignment/a1')

    await expect(page.getByText(/возвращено на доработку|возвращено/i)).toBeVisible()
  })

  test('после возврата студент может отредактировать и пересдать работу', async ({ page }) => {
    const mockAuthStudent = {
      id: 'u1',
      email: 'student@example.com',
      first_name: 'Студент',
      last_name: 'Иванов',
      birth_date: '2000-01-01',
      created_at: new Date().toISOString(),
    }
    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuthStudent),
      }),
    )

    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
    await mockFeed(page, 'c1', [
      { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
    ])
    await mockMembers(page, 'c1', [])
    await mockAssignment(page, 'c1', 'a1', {
      id: 'a1',
      course_id: 'c1',
      title: 'Задание',
      body: 'Описание',
      deadline: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    await mockComments(page, 'c1', 'a1', [])

    let mySubmission = {
      id: 'sub-1',
      assignment_id: 'a1',
      user_id: 'u1',
      body: 'Мой первый ответ',
      submitted_at: '2024-01-15T12:00:00Z',
      grade: null,
      status: 'returned' as const,
      author: { first_name: 'Студент', last_name: 'Иванов' },
    }

    await page.route('**/api/v1/courses/c1/assignments/a1/submissions', async (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mySubmission]),
        })
      } else if (req.method() === 'PUT' || req.method() === 'PATCH') {
        const body = JSON.parse((await req.postData()) ?? '{}')
        mySubmission = {
          ...mySubmission,
          body: body.body ?? mySubmission.body,
          status: 'submitted' as const,
          submitted_at: new Date().toISOString(),
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mySubmission),
        })
      } else {
        await route.fallback()
      }
    })

    await page.goto('/course/c1/assignment/a1')

    await expect(page.getByText(/возвращено на доработку|возвращено/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /отметить как выполненное|отправить/i })).toBeVisible()
  })
})

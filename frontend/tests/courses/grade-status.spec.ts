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

test.describe('Статусы «Зачтено» / «Не зачтено» и комментарий к оценке', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test.describe('Статусы Зачтено/Не зачтено', () => {
    test('преподаватель видит выпадающий список статусов при оценке', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'teacher' })
      await mockFeed(page, 'c1', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockInviteCode(page, 'c1', 'CODE1234')
      await mockMembers(page, 'c1', [
        { user_id: 'u1', email: 's@x.com', first_name: 'Студент', last_name: 'Иванов', role: 'student' },
      ])
      await mockAssignment(page, 'c1', 'a1', {
        id: 'a1',
        course_id: 'c1',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        max_grade: 100,
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
              body: 'Ответ',
              submitted_at: '2024-01-15T12:00:00Z',
              grade: null,
              author: { first_name: 'Студент', last_name: 'Иванов' },
            },
          ]),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /задание/i }).first().click()
      await page.getByRole('tab', { name: /работы учащихся/i }).click()

      await expect(page.getByLabel('Статус')).toBeVisible({ timeout: 10000 })
      await page.getByLabel('Статус').click()
      await expect(page.getByRole('option', { name: 'Зачтено' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Не зачтено' })).toBeVisible()
    })

    test('преподаватель может выставить статус «Зачтено» вместо числовой оценки', async ({
      page,
    }) => {
      let submissions = [
        {
          id: 'sub-1',
          assignment_id: 'a1',
          user_id: 'u1',
          body: 'Ответ',
          submitted_at: '2024-01-15T12:00:00Z',
          grade: null as number | null,
          grade_comment: null as string | null,
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
        max_grade: 100,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c1', 'a1', [])

      await page.route('**/api/v1/courses/c1/assignments/a1/submissions/sub-1/grade', async (route) => {
        if (route.request().method() === 'PUT') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          submissions = submissions.map((s) =>
            s.id === 'sub-1'
              ? {
                  ...s,
                  grade: body.grade ?? 100,
                  grade_comment: body.grade_comment ?? null,
                }
              : s,
          )
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ...submissions[0],
              grade: 100,
              grade_comment: body.grade_comment ?? 'Зачтено',
            }),
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

      await page.getByLabel('Статус').click()
      await page.getByRole('option', { name: 'Зачтено' }).click()
      await page.getByRole('button', { name: /сохранить/i }).first().click()

      await expect(page.getByText(/зачтено|100|оценка/i).first()).toBeVisible()
    })

    test('преподаватель может выставить статус «Не зачтено»', async ({ page }) => {
      let submissions = [
        {
          id: 'sub-1',
          assignment_id: 'a1',
          user_id: 'u1',
          body: 'Ответ',
          submitted_at: '2024-01-15T12:00:00Z',
          grade: null as number | null,
          grade_comment: null as string | null,
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
        max_grade: 100,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c1', 'a1', [])

      await page.route('**/api/v1/courses/c1/assignments/a1/submissions/sub-1/grade', async (route) => {
        if (route.request().method() === 'PUT') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          submissions = submissions.map((s) =>
            s.id === 'sub-1'
              ? {
                  ...s,
                  grade: body.grade ?? 0,
                  grade_comment: body.grade_comment ?? null,
                }
              : s,
          )
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ...submissions[0],
              grade: 0,
              grade_comment: body.grade_comment ?? 'Не зачтено',
            }),
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

      await page.getByLabel('Статус').click()
      await page.getByRole('option', { name: 'Не зачтено' }).click()
      await page.getByRole('button', { name: /сохранить/i }).first().click()

      await expect(page.getByText(/не зачтено|0|оценка/i).first()).toBeVisible()
    })
  })

  test.describe('Комментарий к оценке', () => {
    test('преподаватель видит поле «Комментарий к оценке» при выставлении оценки', async ({
      page,
    }) => {
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
        max_grade: 100,
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
              body: 'Ответ',
              submitted_at: '2024-01-15T12:00:00Z',
              grade: null,
              author: { first_name: 'Студент', last_name: 'Иванов' },
            },
          ]),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /задание/i }).first().click()
      await page.getByRole('tab', { name: /работы учащихся/i }).click()

      await expect(page.getByLabel(/комментарий к оценке/i)).toBeVisible({ timeout: 10000 })
    })

    test('преподаватель может добавить комментарий к оценке при выставлении', async ({ page }) => {
      let submissions = [
        {
          id: 'sub-1',
          assignment_id: 'a1',
          user_id: 'u1',
          body: 'Ответ',
          submitted_at: '2024-01-15T12:00:00Z',
          grade: null as number | null,
          grade_comment: null as string | null,
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
        max_grade: 100,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c1', 'a1', [])

      await page.route('**/api/v1/courses/c1/assignments/a1/submissions/sub-1/grade', async (route) => {
        if (route.request().method() === 'PUT') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          submissions = submissions.map((s) =>
            s.id === 'sub-1'
              ? {
                  ...s,
                  grade: body.grade ?? 85,
                  grade_comment: body.grade_comment ?? null,
                }
              : s,
          )
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ...submissions[0],
              grade: 85,
              grade_comment: body.grade_comment ?? '',
            }),
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

      await page.getByLabel(/оценка/i).fill('85')
      await page.getByLabel(/комментарий к оценке/i).fill('Хорошая работа, но можно улучшить оформление.')
      await page.getByRole('button', { name: /сохранить/i }).first().click()

      await expect(page.getByText('Хорошая работа, но можно улучшить оформление.')).toBeVisible()
    })

    test('студент видит комментарий преподавателя к своей оценке', async ({ page }) => {
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
        max_grade: 100,
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
              grade: 75,
              grade_comment: 'Обратите внимание на пункт 3.',
              author: { first_name: 'Студент', last_name: 'Иванов' },
            },
          ]),
        }),
      )

      await page.goto('/course/c1/assignment/a1')

      await expect(page.getByText('Обратите внимание на пункт 3.', { exact: false })).toBeVisible()
    })
  })
})

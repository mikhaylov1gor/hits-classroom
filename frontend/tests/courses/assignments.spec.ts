import { test, expect } from '@playwright/test'

const mockAuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  first_name: 'Иван',
  last_name: 'Иванов',
  birth_date: '2000-01-01',
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
  return page.route(`**/api/v1/courses/${courseId}/assignments/${assignmentId}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(assignment),
      })
    }
    return route.fallback()
  })
}

function mockComments(
  page: import('@playwright/test').Page,
  courseId: string,
  entityId: string,
  comments: object[] = [],
) {
  return page.route(
    `**/api/v1/courses/${courseId}/assignments/${entityId}/comments`,
    async (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(comments),
        })
      } else if (req.method() === 'POST') {
        const body = JSON.parse((await req.postData()) ?? '{}')
        const created = {
          id: `comment-${Date.now()}`,
          assignment_id: entityId,
          user_id: 'user-1',
          body: body.body ?? '',
          created_at: new Date().toISOString(),
          author: { first_name: 'Иван', last_name: 'Иванов' },
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(created),
        })
      } else {
        await route.fulfill({ status: 404 })
      }
    },
  )
}

test.describe('Вкладка Задания', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test.describe('Список заданий', () => {
    test('отображается список заданий при наличии', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Математика', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Математика', role: 'student' })
      await mockFeed(page, 'course-1', [
        { type: 'assignment', id: 'a1', title: 'Задание 1', deadline: '2024-12-31T23:59:00' },
        { type: 'assignment', id: 'a2', title: 'Задание 2', deadline: null },
      ])
      await mockMembers(page, 'course-1', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Математика.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()

      await expect(page.getByText('Задание 1')).toBeVisible()
      await expect(page.getByText('Задание 2')).toBeVisible()
    })

    test('отображается сообщение при отсутствии заданий', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'course-1', [])
      await mockMembers(page, 'course-1', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()

      await expect(page.getByText('Нет заданий', { exact: true })).toBeVisible()
    })

    test('клик по заданию открывает экран просмотра', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'course-1', [
        {
          type: 'assignment',
          id: 'a1',
          title: 'Решить задачу',
          body: 'Описание задания для студентов.',
          deadline: '2024-12-31T23:59:00',
        },
      ])
      await mockMembers(page, 'course-1', [])
      await mockAssignment(page, 'course-1', 'a1', {
        id: 'a1',
        course_id: 'course-1',
        title: 'Решить задачу',
        body: 'Описание задания для студентов.',
        deadline: '2024-12-31T23:59:00',
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'course-1', 'a1', [])

      await page.route('**/api/v1/courses/course-1/assignments/a1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()

      await page.getByRole('button', { name: /открыть задание решить задачу|решить задачу/i }).click()

      await expect(page).toHaveURL(/\/course\/course-1\/assignment\/a1/)
      await expect(page.getByRole('heading', { name: 'Решить задачу' })).toBeVisible()
      await expect(page.getByText('Описание задания для студентов.')).toBeVisible()
    })
  })

  test.describe('Создание задания (преподаватель)', () => {
    test('кнопка «Новое задание» видна только преподавателю', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Курс', role: 'teacher' })
      await mockFeed(page, 'course-1', [])
      await mockInviteCode(page, 'course-1', 'CODE1234')
      await mockMembers(page, 'course-1', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()

      await expect(page.getByRole('button', { name: /создать задание|новое задание/i })).toBeVisible()
    })

    test('студент не видит кнопку создания задания', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'course-1', [])
      await mockMembers(page, 'course-1', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()

      await expect(page.getByRole('button', { name: /новое задание/i })).not.toBeVisible()
    })

    test('создание задания: обязательные поля — название и описание', async ({ page }) => {
      let feedItems: object[] = []
      await mockCourseList(page, [{ id: 'c-create', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-create', { id: 'c-create', title: 'Курс', role: 'teacher' })
      await mockInviteCode(page, 'c-create', 'CODE1234')
      await mockFeed(page, 'c-create', feedItems)

      await page.route('**/api/v1/courses/c-create/feed', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(feedItems),
        }),
      )
      await page.route('**/api/v1/courses/c-create/assignments', async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          const newAssignment = {
            id: 'a-new',
            course_id: 'c-create',
            title: body.title ?? '',
            body: body.body ?? '',
            deadline: body.deadline ?? null,
            created_at: new Date().toISOString(),
          }
          feedItems = [...feedItems, { ...newAssignment, type: 'assignment' }]
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(newAssignment),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /создать задание|новое задание/i }).click()

      const dialog = page.getByRole('dialog', { name: /новое задание/i })
      await expect(dialog).toBeVisible()

      await dialog.getByLabel('Название задания').fill('Название курсовой')
      await dialog.getByLabel('Описание задания').fill('Подробное описание задания')

      await dialog.getByRole('button', { name: 'Создать' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(page.getByText('Название курсовой')).toBeVisible()
    })

    test('создание задания: прикрепление файлов (опционально)', async ({ page }) => {
      let feedItems: object[] = []
      await mockCourseList(page, [{ id: 'c-files', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-files', { id: 'c-files', title: 'Курс', role: 'teacher' })
      await mockInviteCode(page, 'c-files', 'CODE1234')
      await mockFeed(page, 'c-files', feedItems)

      await page.route('**/api/v1/courses/c-files/feed', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(feedItems),
        }),
      )
      await page.route('**/api/v1/courses/c-files/assignments', async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          const newAssignment = {
            id: 'a-with-files',
            course_id: 'c-files',
            title: body.title ?? '',
            body: body.body ?? '',
            deadline: null,
            created_at: new Date().toISOString(),
          }
          feedItems = [...feedItems, { ...newAssignment, type: 'assignment' }]
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(newAssignment),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /создать задание|новое задание/i }).click()

      const dialog = page.getByRole('dialog', { name: /новое задание/i })
      await dialog.getByLabel('Название задания').fill('Задание с файлами')
      await dialog.getByLabel('Описание задания').fill('Описание')
      await dialog.getByRole('button', { name: /прикрепить файлы/i }).click()
      await page.getByLabel('Прикрепить файлы').setInputFiles({
        name: 'task.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('pdf content'),
      })

      await expect(dialog.getByText('task.pdf')).toBeVisible()
      await dialog.getByRole('button', { name: 'Создать' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(page.getByText('Задание с файлами')).toBeVisible()
    })

    test('валидация: без описания кнопка Создать недоступна или показывается ошибка', async ({
      page,
    }) => {
      await mockCourseList(page, [{ id: 'c-val', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-val', { id: 'c-val', title: 'Курс', role: 'teacher' })
      await mockInviteCode(page, 'c-val', 'CODE1234')
      await mockFeed(page, 'c-val', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /создать задание|новое задание/i }).click()

      const dialog = page.getByRole('dialog', { name: /новое задание/i })
      await dialog.getByLabel('Название задания').fill('Только название')
      await dialog.getByLabel('Описание задания').fill('')

      const createBtn = dialog.getByRole('button', { name: 'Создать' })
      await createBtn.click()

      await expect(page.getByText(/введите описание/i)).toBeVisible()
    })
  })

  test.describe('Студент: сдача ответа', () => {
    test('форма ответа: текст и файлы, кнопка Отметить как выполненное', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-sub', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-sub', { id: 'c-sub', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-sub', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockMembers(page, 'c-sub', [])
      await mockAssignment(page, 'c-sub', 'a1', {
        id: 'a1',
        course_id: 'c-sub',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-sub', 'a1', [])

      await page.route('**/api/v1/courses/c-sub/assignments/a1/submissions', async (route) => {
        const req = route.request()
        if (req.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else if (req.method() === 'POST') {
          const body = JSON.parse((await req.postData()) ?? '{}')
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'sub-1',
              assignment_id: 'a1',
              user_id: 'user-1',
              body: body.body ?? '',
              submitted_at: new Date().toISOString(),
              grade: null,
            }),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /задание/i }).click()

      await expect(page.getByRole('heading', { name: 'Задание' })).toBeVisible()
      await expect(page.getByLabel(/текст ответа|ответ/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /отметить как выполненное/i })).toBeVisible()
    })

    test('отправка ответа обновляет статус', async ({ page }) => {
      let mySubmission: object | null = null
      await mockCourseList(page, [{ id: 'c-send', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-send', { id: 'c-send', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-send', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockMembers(page, 'c-send', [])
      await mockAssignment(page, 'c-send', 'a1', {
        id: 'a1',
        course_id: 'c-send',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-send', 'a1', [])

      await page.route('**/api/v1/courses/c-send/assignments/a1/submissions', async (route) => {
        const req = route.request()
        if (req.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mySubmission ? [mySubmission] : []),
          })
        } else if (req.method() === 'POST') {
          const body = JSON.parse((await req.postData()) ?? '{}')
          mySubmission = {
            id: 'sub-1',
            assignment_id: 'a1',
            user_id: 'user-1',
            body: body.body ?? '',
            submitted_at: new Date().toISOString(),
            grade: null,
          }
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mySubmission),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /задание/i }).click()

      await page.getByLabel(/текст ответа|ответ/i).fill('Мой ответ на задание')
      await page.getByRole('button', { name: /отметить как выполненное/i }).click()

      await expect(page.getByText(/сдано|проверяется/i).first()).toBeVisible()
      await expect(page.getByText('Мой ответ на задание')).toBeVisible()
    })

    test('кнопка Отмена очищает форму без отправки', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-cancel', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-cancel', { id: 'c-cancel', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-cancel', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockMembers(page, 'c-cancel', [])
      await mockAssignment(page, 'c-cancel', 'a1', {
        id: 'a1',
        course_id: 'c-cancel',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-cancel', 'a1', [])

      await page.route('**/api/v1/courses/c-cancel/assignments/a1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /открыть задание задание/i }).click()

      await page.getByLabel(/текст ответа|ответ/i).fill('Не отправлю')
      await page.getByRole('button', { name: /отмена/i }).first().click()

      await expect(page.getByLabel(/текст ответа|ответ/i)).toHaveValue('')
    })

    test('после отправки форма неизменяема (immutable)', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-imm', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-imm', { id: 'c-imm', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-imm', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockMembers(page, 'c-imm', [])
      await mockAssignment(page, 'c-imm', 'a1', {
        id: 'a1',
        course_id: 'c-imm',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-imm', 'a1', [])

      await page.route('**/api/v1/courses/c-imm/assignments/a1/submissions', async (route) => {
        const req = route.request()
        if (req.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'sub-1',
                assignment_id: 'a1',
                user_id: 'user-1',
                body: 'Уже сданный ответ',
                submitted_at: '2024-01-15T12:00:00Z',
                grade: null,
              },
            ]),
          })
        } else if (req.method() === 'POST') {
          await route.fulfill({ status: 409, body: JSON.stringify({ error: 'Already submitted' }) })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /задание/i }).click()

      await expect(page.getByText('Уже сданный ответ')).toBeVisible()
      await expect(page.getByRole('button', { name: /отметить как выполненное/i })).not.toBeVisible()
    })

    test('отображение статуса: не сдано, просрочено, проверяется, оценка', async ({
      page,
    }) => {
      await mockCourseList(page, [{ id: 'c-status', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-status', { id: 'c-status', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-status', [
        {
          type: 'assignment',
          id: 'a1',
          title: 'Задание с оценкой',
          body: 'Описание',
          deadline: '2024-12-31T23:59:00',
        },
      ])
      await mockMembers(page, 'c-status', [])
      await mockAssignment(page, 'c-status', 'a1', {
        id: 'a1',
        course_id: 'c-status',
        title: 'Задание с оценкой',
        body: 'Описание',
        deadline: '2024-12-31T23:59:00',
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-status', 'a1', [])

      await page.route('**/api/v1/courses/c-status/assignments/a1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'sub-1',
                assignment_id: 'a1',
                user_id: 'user-1',
                body: 'Мой ответ',
                submitted_at: '2024-01-10T10:00:00Z',
                grade: 85,
              },
            ]),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /задание с оценкой/i }).click()

      await expect(page.getByText(/оценка|85|балл/i).first()).toBeVisible()
      await expect(page.getByText('Мой ответ')).toBeVisible()
    })
  })

  test.describe('Преподаватель: просмотр ответов и оценка', () => {
    test('преподаватель видит список ответов студентов', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-teach', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-teach', { id: 'c-teach', title: 'Курс', role: 'teacher' })
      await mockFeed(page, 'c-teach', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockInviteCode(page, 'c-teach', 'CODE1234')
      await mockMembers(page, 'c-teach', [
        { user_id: 'u1', email: 's@x.com', first_name: 'Студент', last_name: 'Иванов', role: 'student' },
      ])
      await mockAssignment(page, 'c-teach', 'a1', {
        id: 'a1',
        course_id: 'c-teach',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-teach', 'a1', [])

      await page.route('**/api/v1/courses/c-teach/assignments/a1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
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
                author: { first_name: 'Студент', last_name: 'Иванов' },
              },
            ]),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /открыть задание задание/i }).click()

      await expect(page.getByText('Ответ студента')).toBeVisible()
      await expect(page.getByText(/студент иванов|иванов/i)).toBeVisible()
    })

    test('преподаватель выставляет оценку 0–100', async ({ page }) => {
      let submissions = [
        {
          id: 'sub-1',
          assignment_id: 'a1',
          user_id: 'u1',
          body: 'Ответ студента',
          submitted_at: '2024-01-15T12:00:00Z',
          grade: null as number | null,
          author: { first_name: 'Студент', last_name: 'Иванов' },
        },
      ]
      await mockCourseList(page, [{ id: 'c-grade', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-grade', { id: 'c-grade', title: 'Курс', role: 'teacher' })
      await mockFeed(page, 'c-grade', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockInviteCode(page, 'c-grade', 'CODE1234')
      await mockMembers(page, 'c-grade', [])
      await mockAssignment(page, 'c-grade', 'a1', {
        id: 'a1',
        course_id: 'c-grade',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      await mockComments(page, 'c-grade', 'a1', [])

      await page.route(
        '**/api/v1/courses/c-grade/assignments/a1/submissions/sub-1/grade',
        async (route) => {
          if (route.request().method() === 'PUT') {
            const body = JSON.parse((await route.request().postData()) ?? '{}')
            submissions = submissions.map((s) =>
              s.id === 'sub-1' ? { ...s, grade: body.grade ?? 0 } : s,
            )
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ ...submissions[0], grade: body.grade }),
            })
          } else {
            await route.fallback()
          }
        },
      )
      await page.route('**/api/v1/courses/c-grade/assignments/a1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(submissions),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /открыть задание задание/i }).click()

      await page.getByLabel(/оценка/i).fill('92')
      await page.getByRole('button', { name: /сохранить оценку/i }).click()

      await expect(page.getByText('Оценка: 92')).toBeVisible()
    })

    test('преподаватель добавляет комментарий к заданию', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-comment', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-comment', { id: 'c-comment', title: 'Курс', role: 'teacher' })
      await mockFeed(page, 'c-comment', [
        { type: 'assignment', id: 'a1', title: 'Задание', body: 'Описание', deadline: null },
      ])
      await mockInviteCode(page, 'c-comment', 'CODE1234')
      await mockMembers(page, 'c-comment', [])
      await mockAssignment(page, 'c-comment', 'a1', {
        id: 'a1',
        course_id: 'c-comment',
        title: 'Задание',
        body: 'Описание',
        deadline: null,
        created_at: '2024-01-01T00:00:00Z',
      })
      let comments: object[] = []
      await mockComments(page, 'c-comment', 'a1', comments)

      await page.route(
        `**/api/v1/courses/c-comment/assignments/a1/comments`,
        async (route) => {
          const req = route.request()
          if (req.method() === 'GET') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(comments),
            })
          } else if (req.method() === 'POST') {
            const body = JSON.parse((await req.postData()) ?? '{}')
            const created = {
              id: `comment-${Date.now()}`,
              assignment_id: 'a1',
              user_id: 'user-1',
              body: body.body ?? '',
              created_at: new Date().toISOString(),
              author: { first_name: 'Иван', last_name: 'Иванов' },
            }
            comments = [...comments, created]
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify(created),
            })
          } else {
            await route.fallback()
          }
        },
      )

      await page.route('**/api/v1/courses/c-comment/assignments/a1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()
      await page.getByRole('button', { name: /открыть задание задание/i }).click()

      await expect(page).toHaveURL(/\/course\/c-comment\/assignment\/a1/)
      await page.getByText(/добавить комментарий/i).click()
      await page.getByLabel(/текст комментария|комментарий/i).fill('Отличная работа!')
      await page.getByRole('button', { name: 'Отправить' }).first().click()

      await expect(page.getByText('Отличная работа!')).toBeVisible()
    })
  })
})

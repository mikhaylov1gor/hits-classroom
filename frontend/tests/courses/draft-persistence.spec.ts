import { test, expect } from '@playwright/test'

const mockAuthUser = {
  id: 'user-1',
  email: 'student@example.com',
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

test.describe('Сохранение прогресса прикреплённых файлов при перезагрузке', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('после ввода текста и перезагрузки страницы черновик восстанавливается', async ({
    page,
  }) => {
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
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /задания/i }).click()
    await page.getByRole('button', { name: /задание/i }).first().click()
    await expect(page.getByRole('button', { name: /добавить или создать/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /добавить или создать/i }).click()
    await page.getByRole('menuitem', { name: 'Ссылка' }).click()
    const linkDialog = page.getByRole('dialog', { name: /добавить ссылку/i })
    await linkDialog.getByLabel('URL').fill('https://drive.google.com/draft-answer')
    await linkDialog.getByRole('button', { name: 'Добавить' }).click()

    await page.reload()

    await expect(page.getByText(/drive\.google\.com|draft-answer/i)).toBeVisible()
  })

  test('после прикрепления файлов и перезагрузки прогресс файлов сохраняется (имена отображаются)', async ({
    page,
  }) => {
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
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /задания/i }).click()
    await page.getByRole('button', { name: /задание/i }).first().click()
    await expect(page.getByRole('button', { name: /добавить или создать/i })).toBeVisible({ timeout: 10000 })

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /добавить или создать/i }).click()
    await page.getByRole('menuitem', { name: 'Файл' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf content'),
    })

    await expect(page.getByText('report.pdf')).toBeVisible()

    await page.reload()

    await expect(
      page.getByText(/report\.pdf|сохранённый прогресс.*report\.pdf/i),
    ).toBeVisible()
  })

  test('после добавления ссылок и перезагрузки ссылки сохраняются', async ({ page }) => {
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
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /задания/i }).click()
    await page.getByRole('button', { name: /задание/i }).first().click()
    await expect(page.getByRole('button', { name: /добавить или создать/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /добавить или создать/i }).click()
    await page.getByRole('menuitem', { name: 'Ссылка' }).click()
    const linkDialog = page.getByRole('dialog', { name: /добавить ссылку/i })
    await linkDialog.getByLabel('URL').fill('https://drive.google.com/file/d/example')
    await linkDialog.getByRole('button', { name: 'Добавить' }).click()

    await expect(page.getByText(/drive.google.com|example/i)).toBeVisible()

    await page.reload()

    await expect(page.getByText(/drive.google.com|example/i)).toBeVisible()
  })

  test('полный черновик: текст + файлы сохраняется после перезагрузки', async ({ page }) => {
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
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /задания/i }).click()
    await page.getByRole('button', { name: /задание/i }).first().click()
    await expect(page.getByRole('button', { name: /добавить или создать/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /добавить или создать/i }).click()
    await page.getByRole('menuitem', { name: 'Ссылка' }).click()
    const linkDialog = page.getByRole('dialog', { name: /добавить ссылку/i })
    await linkDialog.getByLabel('URL').fill('https://docs.google.com/full-answer')
    await linkDialog.getByRole('button', { name: 'Добавить' }).click()

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /добавить или создать/i }).click()
    await page.getByRole('menuitem', { name: 'Файл' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'homework.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('doc content'),
    })

    await page.reload()

    await expect(page.getByText(/docs\.google\.com|full-answer/i)).toBeVisible()
    await expect(
      page.getByText(/homework\.docx|сохранённый прогресс.*homework/i),
    ).toBeVisible()
  })
})

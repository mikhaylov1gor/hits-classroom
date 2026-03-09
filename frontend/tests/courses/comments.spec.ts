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

test.describe('Общие комментарии к постам, материалам, заданиям', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test.describe('Комментарии к постам', () => {
    test('отображается кнопка «Добавить комментарий» при просмотре поста', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c1', [
        { type: 'post', id: 'p1', title: 'Пост', body: 'Текст', created_at: '2024-01-01T00:00:00Z' },
      ])
      await mockMembers(page, 'c1', [])
      await page.route('**/api/v1/courses/c1/posts/p1/comments', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()
      await page.getByRole('button', { name: /пост/i }).first().click()

      await expect(page.getByText(/добавить комментарий/i)).toBeVisible()
    })

    test('студент может добавить текстовый комментарий к посту', async ({ page }) => {
      let comments: object[] = []
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c1', [
        { type: 'post', id: 'p1', title: 'Пост', body: 'Текст', created_at: '2024-01-01T00:00:00Z' },
      ])
      await mockMembers(page, 'c1', [])
      await page.route('**/api/v1/courses/c1/posts/p1/comments', async (route) => {
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
            post_id: 'p1',
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
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await page.getByRole('button', { name: /добавить комментарий/i }).first().click({ force: true })
      await page.getByLabel(/текст комментария|написать комментарий/i).fill('Мой комментарий к посту')
      await page.getByRole('button', { name: 'Отправить' }).first().click()

      await page.getByRole('button', { name: /комментарии \(\d+\)/i }).click()
      await expect(page.getByText('Мой комментарий к посту')).toBeVisible()
    })
  })

  test.describe('Комментарии к материалам', () => {
    test('отображается кнопка «Добавить комментарий» при просмотре материала', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c1', [
        {
          type: 'material',
          id: 'm1',
          title: 'Материал',
          body: 'Описание',
          created_at: '2024-01-01T00:00:00Z',
        },
      ])
      await mockMembers(page, 'c1', [])
      await page.route('**/api/v1/courses/c1/materials/m1/comments', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /материалы/i }).click()

      await expect(page.getByText(/добавить комментарий/i)).toBeVisible()
    })

    test('студент может добавить комментарий к материалу', async ({ page }) => {
      let comments: object[] = []
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c1', [
        {
          type: 'material',
          id: 'm1',
          title: 'Материал',
          body: 'Описание',
          created_at: '2024-01-01T00:00:00Z',
        },
      ])
      await mockMembers(page, 'c1', [])
      await page.route('**/api/v1/courses/c1/materials/m1/comments', async (route) => {
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
            material_id: 'm1',
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
      })
      await page.route('**/api/v1/courses/c1/materials/m1', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'm1',
            course_id: 'c1',
            title: 'Материал',
            body: 'Описание',
            created_at: '2024-01-01T00:00:00Z',
          }),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /материалы/i }).click()

      await page.getByRole('button', { name: /добавить комментарий/i }).first().click()
      await page.getByLabel(/текст комментария|написать комментарий/i).fill('Комментарий к материалу')
      await page.getByRole('button', { name: /отправить/i }).first().click()

      await page.getByRole('button', { name: /комментарии \(\d+\)/i }).click()
      await expect(page.getByText('Комментарий к материалу')).toBeVisible()
    })
  })

  test.describe('Комментарии к заданиям', () => {
    test('отображается кнопка «Добавить комментарий» при просмотре задания', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c1', [
        {
          type: 'assignment',
          id: 'a1',
          title: 'Задание',
          body: 'Описание',
          deadline: null,
        },
      ])
      await mockMembers(page, 'c1', [])
      await page.route('**/api/v1/courses/c1/assignments/a1/comments', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      )
      await page.route('**/api/v1/courses/c1/assignments/a1', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'a1',
            course_id: 'c1',
            title: 'Задание',
            body: 'Описание',
            deadline: null,
            created_at: '2024-01-01T00:00:00Z',
          }),
        }),
      )
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

      await expect(page.getByText(/добавить комментарий/i)).toBeVisible()
    })

    test('преподаватель может добавить комментарий к заданию', async ({ page }) => {
      let comments: object[] = []
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'teacher' })
      await mockFeed(page, 'c1', [
        {
          type: 'assignment',
          id: 'a1',
          title: 'Задание',
          body: 'Описание',
          deadline: null,
        },
      ])
      await mockMembers(page, 'c1', [])
      await page.route('**/api/v1/courses/c1/assignments/a1/comments', async (route) => {
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
      })
      await page.route('**/api/v1/courses/c1/assignments/a1', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'a1',
            course_id: 'c1',
            title: 'Задание',
            body: 'Описание',
            deadline: null,
            created_at: '2024-01-01T00:00:00Z',
          }),
        }),
      )
      await page.route('**/api/v1/courses/c1/assignments/a1/submissions', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      )

      await page.goto('/course/c1/assignment/a1')

      await page.getByRole('button', { name: /добавить комментарий/i }).first().click()
      await page.getByLabel(/текст комментария|написать комментарий/i).fill('Комментарий преподавателя')
      await page.getByRole('button', { name: /отправить/i }).first().click()

      await expect(page.getByText('Комментарий преподавателя')).toBeVisible()
    })
  })
})

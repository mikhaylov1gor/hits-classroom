import { test, expect } from '@playwright/test'

const mockAuthUser = {
  id: 'user-1',
  email: 'owner@example.com',
  first_name: 'Иван',
  last_name: 'Владелец',
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

test.describe('Добавление преподавателей по email', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test.describe('При создании курса', () => {
    test('при создании курса отображается поле для добавления преподавателей по email', async ({
      page,
    }) => {
      await mockCourseList(page, [])
      await page.route('**/api/v1/courses', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /добавить курс/i }).click()

      await expect(page.getByText(/добавить преподавателей по email/i)).toBeVisible()
      await expect(page.getByLabel(/email преподавателя/i)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Добавить' })).toBeVisible()
    })

    test('можно добавить несколько email преподавателей перед созданием курса', async ({
      page,
    }) => {
      await mockCourseList(page, [])
      await page.route('**/api/v1/courses', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /добавить курс/i }).click()

      await page.getByLabel(/email преподавателя/i).fill('teacher1@example.com')
      await page.getByRole('button', { name: 'Добавить' }).click()

      await expect(page.getByText('teacher1@example.com')).toBeVisible()

      await page.getByLabel(/email преподавателя/i).fill('teacher2@example.com')
      await page.getByRole('button', { name: 'Добавить' }).click()

      await expect(page.getByText('teacher2@example.com')).toBeVisible()
    })

    test('при создании курса вызывается invite-teacher для каждого добавленного email', async ({
      page,
    }) => {
      const invitedEmails: string[] = []
      await mockCourseList(page, [])

      await page.route('**/api/v1/courses', async (route) => {
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
              id: 'course-new',
              title: body.title ?? 'Новый курс',
              role: 'owner',
            }),
          })
        } else {
          await route.fallback()
        }
      })

      await page.route('**/api/v1/courses/course-new/invite-teacher', async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          invitedEmails.push(body.email ?? '')
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user_id: 'u-teacher',
              email: body.email,
              first_name: 'Teacher',
              last_name: 'User',
              role: 'teacher',
            }),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /добавить курс/i }).click()

      await page.getByLabel('Название курса').fill('Курс с преподавателями')
      await page.getByLabel(/email преподавателя/i).fill('newteacher@example.com')
      await page.getByRole('button', { name: 'Добавить' }).click()
      await page.getByRole('button', { name: 'Создать' }).click()

      await expect(page.getByText('Курс с преподавателями').first()).toBeVisible()
      expect(invitedEmails).toContain('newteacher@example.com')
    })
  })

  test.describe('В настройках курса', () => {
    test('владелец видит поле для приглашения преподавателя по email в настройках', async ({
      page,
    }) => {
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'owner' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'owner' })
      await mockFeed(page, 'c1', [])
      await mockInviteCode(page, 'c1', 'CODE1234')
      await mockMembers(page, 'c1', [
        { user_id: 'user-1', email: 'owner@example.com', first_name: 'Иван', last_name: 'Владелец', role: 'owner' },
      ])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: владелец/i }).click()
      await page.getByRole('tab', { name: /настройки/i }).click()

      await expect(page.getByLabel(/email преподавателя/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /добавить/i })).toBeVisible()
    })

    test('владелец может добавить преподавателя по email в существующий курс', async ({
      page,
    }) => {
      let members = [
        { user_id: 'user-1', email: 'owner@example.com', first_name: 'Иван', last_name: 'Владелец', role: 'owner' },
      ]

      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'owner' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'owner' })
      await mockFeed(page, 'c1', [])
      await mockInviteCode(page, 'c1', 'CODE1234')

      await page.route('**/api/v1/courses/c1/members', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(members),
        }),
      )
      await page.route('**/api/v1/courses/c1/invite-teacher', async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          const newMember = {
            user_id: 'u-teacher',
            email: body.email ?? '',
            first_name: 'Новый',
            last_name: 'Преподаватель',
            role: 'teacher',
          }
          members = [...members, newMember]
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(newMember),
          })
        } else {
          await route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: владелец/i }).click()
      await page.getByRole('tab', { name: /настройки/i }).click()

      await page.getByLabel(/email преподавателя/i).fill('teacher@course.com')
      await page.getByRole('button', { name: /добавить/i }).click()

      await page.getByRole('tab', { name: /пользователи/i }).click()
      await expect(page.getByText(/новый преподаватель|teacher@course.com/i)).toBeVisible()
    })

    test('при несуществующем email показывается ошибка', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'owner' }])
      await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'owner' })
      await mockFeed(page, 'c1', [])
      await mockInviteCode(page, 'c1', 'CODE1234')
      await mockMembers(page, 'c1', [])

      await page.route('**/api/v1/courses/c1/invite-teacher', (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'User not found' }),
        }),
      )

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: владелец/i }).click()
      await page.getByRole('tab', { name: /настройки/i }).click()

      await page.getByLabel(/email преподавателя/i).fill('nonexistent@example.com')
      await page.getByRole('button', { name: /добавить/i }).click()

      await expect(page.getByText(/не найден|пользователь с таким email/i)).toBeVisible()
    })
  })
})

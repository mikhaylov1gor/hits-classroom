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

test.describe('Создание постов студентами', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('студент видит кнопку создания поста в табе Посты', async ({ page }) => {
    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
    await mockFeed(page, 'c1', [])
    await mockMembers(page, 'c1', [])

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /посты/i }).click()

    await expect(
      page.getByRole('button', { name: /новое объявление|создать пост|новый пост/i }),
    ).toBeVisible()
  })

  test('студент может открыть диалог создания поста', async ({ page }) => {
    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })
    await mockFeed(page, 'c1', [])
    await mockMembers(page, 'c1', [])

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /посты/i }).click()
    await page.getByRole('button', { name: /новое объявление|создать пост|новый пост/i }).click()

    const dialog = page.getByRole('dialog', { name: /новый пост|создать пост/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel(/заголовок|название/i)).toBeVisible()
    await expect(dialog.getByLabel(/содержание|описание/i)).toBeVisible()
  })

  test('студент может создать пост: заполнение формы и отправка', async ({ page }) => {
    let feedItems: object[] = []
    await mockCourseList(page, [{ id: 'c1', title: 'Курс', role: 'student' }])
    await mockCourse(page, 'c1', { id: 'c1', title: 'Курс', role: 'student' })

    await page.route('**/api/v1/courses/c1/feed', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(feedItems),
      }),
    )
    await page.route('**/api/v1/courses/c1/posts', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse((await route.request().postData()) ?? '{}')
        const newPost = {
          id: 'post-new',
          course_id: 'c1',
          title: body.title ?? '',
          body: body.body ?? '',
          created_at: new Date().toISOString(),
        }
        feedItems = [...feedItems, { ...newPost, type: 'post' }]
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newPost),
        })
      } else {
        await route.fallback()
      }
    })
    await mockMembers(page, 'c1', [])

    await page.goto('/')
    await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
    await page.getByRole('tab', { name: /посты/i }).click()
    await page.getByRole('button', { name: /новое объявление|создать пост|новый пост/i }).click()

    const dialog = page.getByRole('dialog', { name: /новый пост|создать пост/i })
    await dialog.getByLabel(/заголовок поста|название/i).fill('Пост от студента')
    await dialog.getByLabel(/содержание поста|описание/i).fill('Текст поста от студента')
    await dialog.getByRole('button', { name: 'Создать' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Пост от студента')).toBeVisible()
  })
})

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

function mockCourse(page: import('@playwright/test').Page, courseId: string, course: object) {
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

test.describe('Экран курса', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test.describe('Открытие и навигация', () => {
    test('клик по курсу в списке ведёт на страницу курса', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Математика', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Математика', role: 'student' })
      await mockFeed(page, 'course-1')

      await page.goto('/')
      await page.getByRole('button', { name: /Математика.*роль: студент/i }).click()

      await expect(page).toHaveURL(/\/course\/course-1$/)
    })

    test('на странице курса отображается название', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Математика', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Математика', role: 'student' })
      await mockFeed(page, 'course-1')

      await page.goto('/')
      await page.getByRole('button', { name: /Математика.*роль: студент/i }).click()

      await expect(page.getByRole('heading', { name: 'Математика' })).toBeVisible()
    })

    test('отображаются табы: Задания, Посты, Материалы, Пользователи', async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'course-1')

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()

      await expect(page.getByRole('tab', { name: /задания/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /посты/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /материалы/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /пользователи/i })).toBeVisible()
    })
  })

  test.describe('Условные табы', () => {
    test('у студента нет таба Настройки', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-student', title: 'Курс студента', role: 'student' }])
      await mockCourse(page, 'c-student', { id: 'c-student', title: 'Курс студента', role: 'student' })
      await mockFeed(page, 'c-student')

      await page.goto('/')
      await page.getByRole('button', { name: /курс студента.*роль: студент/i }).click()

      await expect(page).toHaveURL(/\/course\/c-student$/)
      await expect(page.getByRole('tab', { name: /настройки/i })).not.toBeVisible()
    })

    test('у владельца есть таб Настройки', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-owner', title: 'Курс владельца', role: 'owner' }])
      await mockCourse(page, 'c-owner', { id: 'c-owner', title: 'Курс владельца', role: 'owner' })
      await mockFeed(page, 'c-owner')
      await mockInviteCode(page, 'c-owner', 'ABCD1234')
      await mockMembers(page, 'c-owner')

      await page.goto('/')
      await page.getByRole('button', { name: /курс владельца.*роль: владелец/i }).click()

      await expect(page).toHaveURL(/\/course\/c-owner$/)
      await expect(page.getByRole('tab', { name: /настройки/i })).toBeVisible()
    })
  })

  test.describe('Переключение табов', () => {
    test.beforeEach(async ({ page }) => {
      await mockCourseList(page, [{ id: 'course-1', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'course-1', { id: 'course-1', title: 'Курс', role: 'student' })
      await mockFeed(page, 'course-1', [
        { type: 'assignment', id: 'a1', title: 'Задание 1' },
        { type: 'post', id: 'p1', title: 'Пост 1' },
        { type: 'material', id: 'm1', title: 'Материал 1' },
      ])
      await mockMembers(page, 'course-1', [
        { user_id: 'u1', email: 'a@b.com', first_name: 'Анна', last_name: 'Петрова', role: 'teacher' },
      ])
    })

    test('таб Задания показывает список заданий', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /задания/i }).click()

      await expect(page.getByText('Задание 1')).toBeVisible()
    })

    test('таб Посты показывает список постов', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await expect(page.getByText('Пост 1')).toBeVisible()
    })

    test('таб Материалы показывает список материалов', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /материалы/i }).click()

      await expect(page.getByText('Материал 1')).toBeVisible()
    })

    test('таб Пользователи показывает список участников', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()

      await expect(page.getByText('Анна Петрова')).toBeVisible()
    })
  })

  test.describe('Владелец', () => {
    test.beforeEach(async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-owner', title: 'Старое название', role: 'owner' }])
      await mockCourse(page, 'c-owner', { id: 'c-owner', title: 'Старое название', role: 'owner' })
      await mockFeed(page, 'c-owner')
      await mockInviteCode(page, 'c-owner', 'CODE1234')
    })

    test('переименование: ввод нового названия и сохранение', async ({ page }) => {
      await page.route('**/api/v1/courses/c-owner', async (route) => {
        const method = route.request().method()
        if (method === 'PATCH') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'c-owner', title: body.title ?? 'Старое название', role: 'owner' }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'c-owner', title: 'Старое название', role: 'owner' }),
          })
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /старое название.*роль: владелец/i }).click()

      await page.getByRole('button', { name: /переименовать/i }).click()
      await page.getByLabel('Название курса').fill('Новое название')
      await page.getByRole('button', { name: 'Сохранить' }).click()

      await expect(page.getByRole('heading', { name: 'Новое название' })).toBeVisible()
    })

    test('удаление: открывается диалог подтверждения', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /старое название.*роль: владелец/i }).click()
      await page.getByRole('tab', { name: /настройки/i }).click()
      await page.getByRole('button', { name: /удалить курс/i }).click()

      await expect(page.getByRole('dialog', { name: /удалить курс/i })).toBeVisible()
      await expect(page.getByText(/безвозвратно/i)).toBeVisible()
    })

    test('удаление: отмена закрывает диалог', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /старое название.*роль: владелец/i }).click()
      await page.getByRole('tab', { name: /настройки/i }).click()
      await page.getByRole('button', { name: /удалить курс/i }).click()
      await page.getByRole('button', { name: 'Отмена' }).click()

      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('Преподаватель', () => {
    test('в табе Настройки отображается код приглашения', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-teacher', title: 'Курс препода', role: 'teacher' }])
      await mockCourse(page, 'c-teacher', { id: 'c-teacher', title: 'Курс препода', role: 'teacher' })
      await mockFeed(page, 'c-teacher')
      await mockInviteCode(page, 'c-teacher', 'TEACH123')

      await page.goto('/')
      await page.getByRole('button', { name: /курс препода.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /настройки/i }).click()

      await expect(page.getByText(/код приглашения/i)).toBeVisible()
      await expect(page.getByText('TEACH123')).toBeVisible()
    })
  })

  test.describe('Редирект из списка', () => {
    test('клик по карточке курса открывает страницу курса', async ({ page }) => {
      await mockCourseList(page, [
        { id: 'course-redirect', title: 'Курс для редиректа', role: 'student' },
      ])
      await mockCourse(page, 'course-redirect', {
        id: 'course-redirect',
        title: 'Курс для редиректа',
        role: 'student',
      })
      await mockFeed(page, 'course-redirect')

      await page.goto('/')
      await expect(page).toHaveURL('/')
      await page.getByRole('button', { name: /курс для редиректа.*роль: студент/i }).click()

      await expect(page).toHaveURL(/\/course\/course-redirect$/)
      await expect(page.getByRole('heading', { name: 'Курс для редиректа' })).toBeVisible()
    })
  })
})

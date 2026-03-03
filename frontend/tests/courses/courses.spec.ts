import { test, expect } from '@playwright/test'

const mockAuthUser = {
  id: 'user-1',
  email: 'student@example.com',
  first_name: 'Иван',
  last_name: 'Иванов',
  birth_date: '2000-01-01',
  created_at: new Date().toISOString(),
}

test.describe('Список курсов и добавление по коду', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuthUser),
      })
    })
  })

  test('отображение списка курсов с ролями', async ({ page }) => {
    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'course-1', title: 'Математика', role: 'student' },
          { id: 'course-2', title: 'Физика', role: 'teacher' },
          { id: 'course-3', title: 'Программирование', role: 'owner' },
        ]),
      })
    })

    await page.goto('/')

    await expect(page.getByRole('button', { name: /Математика.*роль: студент/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Физика.*роль: преподаватель/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Программирование.*роль: владелец/i })).toBeVisible()

    await expect(page.getByText(/роль: студент/i)).toBeVisible()
    await expect(page.getByText(/роль: преподаватель/i)).toBeVisible()
    await expect(page.getByText(/роль: владелец/i)).toBeVisible()
  })

  test('клик по курсу открывает страницу курса', async ({ page }) => {
    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'course-42', title: 'Курс 42', role: 'student' }]),
      })
    })

    await page.goto('/')

    await page.getByRole('button', { name: /Курс 42.*роль: студент/i }).click()

    await expect(page).toHaveURL(/\/course\/course-42$/)
  })

  test('добавление курса по валидному коду обновляет список', async ({ page }) => {
    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'course-1', title: 'Математика', role: 'student' }]),
      })
    })

    await page.route('**/api/v1/courses/join', async (route) => {
      const body = (await route.request().postDataJSON()) as { code?: string }

      expect(body.code).toBe('ABC12345')

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'course-2',
          title: 'Физика',
          role: 'student',
        }),
      })
    })

    await page.goto('/')

    await expect(page.getByRole('button', { name: /Математика.*роль: студент/i })).toBeVisible()

    await page.getByLabel(/код курса/i).fill('ABC12345')
    await page.getByRole('button', { name: /присоединиться/i }).click()

    await expect(page.getByRole('button', { name: /Физика.*роль: студент/i })).toBeVisible()
  })

  test('ошибка при добавлении по неверному коду', async ({ page }) => {
    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/api/v1/courses/join', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Course not found or invalid code',
        }),
      })
    })

    await page.goto('/')

    await page.getByLabel(/код курса/i).fill('WRONG123')
    await page.getByRole('button', { name: /присоединиться/i }).click()

    await expect(page.getByText(/неверный или недействительный код курса/i)).toBeVisible()
  })

  test('отображение разных ролей в карточках курсов', async ({ page }) => {
    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'c1', title: 'Курс студента', role: 'student' },
          { id: 'c2', title: 'Курс преподавателя', role: 'teacher' },
          { id: 'c3', title: 'Курс владельца', role: 'owner' },
        ]),
      })
    })

    await page.goto('/')

    await expect(
      page.getByText(/курс студента/i).locator('..').getByText(/роль: студент/i),
    ).toBeVisible()
    await expect(
      page.getByText(/курс преподавателя/i).locator('..').getByText(/роль: преподаватель/i),
    ).toBeVisible()
    await expect(
      page.getByText(/курс владельца/i).locator('..').getByText(/роль: владелец/i),
    ).toBeVisible()
  })

  test('при большом количестве курсов отображается список', async ({ page }) => {
    await page.route('**/api/v1/courses', async (route) => {
      const manyCourses = Array.from({ length: 20 }).map((_, index) => ({
        id: `course-${index + 1}`,
        title: `Курс ${index + 1}`,
        role: index % 3 === 0 ? 'owner' : index % 2 === 0 ? 'teacher' : 'student',
      }))

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manyCourses),
      })
    })

    await page.goto('/')

    await expect(page.getByRole('button', { name: /^Курс 1\s/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Курс 20\s/ })).toBeVisible()
  })
})



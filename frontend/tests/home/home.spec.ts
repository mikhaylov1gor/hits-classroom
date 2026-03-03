import { test, expect } from '@playwright/test'

test.describe('Главный экран и профиль', () => {
  test('открытие главного экрана после логина и отображение табов', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-token',
          user: {
            id: 'user-1',
            email: 'student@example.com',
            first_name: 'Иван',
            last_name: 'Иванов',
            birth_date: '2000-01-01',
            created_at: new Date().toISOString(),
          },
        }),
      })
    })

    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'student@example.com',
          first_name: 'Иван',
          last_name: 'Иванов',
          birth_date: '2000-01-01',
          created_at: new Date().toISOString(),
        }),
      })
    })

    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/login')

    await page.getByLabel('Email').fill('student@example.com')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByRole('button', { name: /войти/i }).click()

    await expect(page).toHaveURL(/\/$/)

    await expect(page.getByRole('tab', { name: /список курсов/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /профиль/i })).toBeVisible()
  })

  test('переключение на вкладку Профиль и отображение данных пользователя', async ({ page }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'student@example.com',
          first_name: 'Иван',
          last_name: 'Иванов',
          birth_date: '2000-01-01',
          created_at: new Date().toISOString(),
        }),
      })
    })

    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/')

    await page.getByRole('tab', { name: /профиль/i }).click()

    await expect(page.getByLabel('ФИО')).toHaveValue('Иван Иванов')
    await expect(page.getByLabel('Email')).toHaveValue('student@example.com')
    await expect(page.getByLabel('Дата рождения')).toHaveValue('2000-01-01')
  })

  test('редактирование профиля и сохранение изменений', async ({ page }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-1',
            email: 'student@example.com',
            first_name: 'Иван',
            last_name: 'Иванов',
            birth_date: '2000-01-01',
            created_at: new Date().toISOString(),
          }),
        })
      } else {
        const body = (await route.request().postDataJSON()) as {
          first_name?: string
          last_name?: string
          birth_date?: string
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-1',
            email: 'student@example.com',
            first_name: body.first_name ?? 'Иван',
            last_name: body.last_name ?? 'Иванов',
            birth_date: body.birth_date ?? '2000-01-01',
            created_at: new Date().toISOString(),
          }),
        })
      }
    })

    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/')

    await page.getByRole('tab', { name: /профиль/i }).click()

    await page.getByLabel('ФИО').fill('Пётр Петров')
    await page.getByLabel('Дата рождения').fill('1999-12-31')

    await page.getByRole('button', { name: /сохранить/i }).click()

    await expect(page.getByLabel('ФИО')).toHaveValue('Пётр Петров')
    await expect(page.getByLabel('Дата рождения')).toHaveValue('1999-12-31')
  })

  test('logout перенаправляет на страницу логина', async ({ page }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'student@example.com',
          first_name: 'Иван',
          last_name: 'Иванов',
          birth_date: '2000-01-01',
          created_at: new Date().toISOString(),
        }),
      })
    })

    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/')

    await page.getByRole('tab', { name: /профиль/i }).click()

    await page.getByRole('button', { name: /выйти/i }).click()

    await expect(page).toHaveURL(/\/login$/)
  })

  test('бургер-меню показывает ФИО и последние курсы и ведёт в курс при клике', async ({
    page,
  }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'teacher@example.com',
          first_name: 'Иван',
          last_name: 'Петров',
          birth_date: '1990-05-10',
          created_at: new Date().toISOString(),
        }),
      })
    })

    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          Array.from({ length: 10 }).map((_, index) => ({
            id: `course-${index + 1}`,
            title: `Курс ${index + 1}`,
            role: index % 2 === 0 ? 'teacher' : 'student',
          })),
        ),
      })
    })

    await page.goto('/')

    await page.getByRole('button', { name: /открыть меню/i }).click()

    await expect(page.getByText(/иван петров/i)).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /главная/i })).toBeVisible()

    await expect(page.getByRole('menuitem', { name: /курс 10/i })).toBeVisible()

    await page.getByRole('menuitem', { name: /курс 10/i }).click()

    await expect(page).toHaveURL(/\/course\/course-10$/)
  })

  test('пустой список курсов показывает плейсхолдер', async ({ page }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'student@example.com',
          first_name: 'Иван',
          last_name: 'Иванов',
          birth_date: '2000-01-01',
          created_at: new Date().toISOString(),
        }),
      })
    })

    await page.route('**/api/v1/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/')

    await page.getByRole('tab', { name: /список курсов/i }).click()

    await expect(page.getByText(/у вас пока нет курсов/i)).toBeVisible()
  })
})



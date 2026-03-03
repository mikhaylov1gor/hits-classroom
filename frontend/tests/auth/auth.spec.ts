import { test, expect } from '@playwright/test'

test.describe('Авторизация и регистрация', () => {
  test('успешный вход перенаправляет на главную страницу /', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      const request = route.request()
      const body = (await request.postDataJSON()) as { email?: string; password?: string }

      expect(body).toMatchObject({
        email: 'student@example.com',
      })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-jwt-token',
          user: {
            id: 'user-1',
            email: 'student@example.com',
            first_name: 'Test',
            last_name: 'Student',
            birth_date: '2000-01-01',
            created_at: new Date().toISOString(),
          },
        }),
      })
    })

    await page.goto('/login')

    await page.getByLabel('Email').fill('student@example.com')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByRole('button', { name: /войти/i }).click()

    await expect(page).toHaveURL(/\/$/)
  })

  test('неуспешный вход с неверными данными показывает ошибку', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid credentials',
        }),
      })
    })

    await page.goto('/login')

    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Пароль').fill('wrong-password')
    await page.getByRole('button', { name: /войти/i }).click()

    await expect(page.getByText(/неверный email или пароль/i)).toBeVisible()
  })

  test('переход со страницы входа на регистрацию', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('link', { name: /создать аккаунт/i }).click()

    await expect(page).toHaveURL(/\/register$/)
  })

  test('успешная регистрация выполняет авто-вход и перенаправляет на /', async ({ page }) => {
    await page.route('**/api/v1/auth/register', async (route) => {
      const body = (await route.request().postDataJSON()) as {
        email: string
        password: string
        birth_date: string
        first_name?: string
        last_name?: string
      }

      expect(body).toMatchObject({
        email: 'new.user@example.com',
      })

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-2',
          email: body.email,
          first_name: body.first_name,
          last_name: body.last_name,
          birth_date: body.birth_date,
          created_at: new Date().toISOString(),
        }),
    })
    })

    await page.route('**/api/v1/auth/login', async (route) => {
      const body = (await route.request().postDataJSON()) as { email?: string }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-jwt-token',
          user: {
            id: 'user-2',
            email: body.email ?? 'new.user@example.com',
            first_name: 'New',
            last_name: 'User',
            birth_date: '2000-01-01',
            created_at: new Date().toISOString(),
          },
        }),
      })
    })

    await page.goto('/register')

    await page.getByLabel('Email').fill('new.user@example.com')
    await page.getByLabel('Пароль', { exact: true }).fill('password123')
    await page.getByLabel('Подтвердите пароль').fill('password123')
    await page.getByLabel('ФИО').fill('Иван Иванов')
    await page.getByLabel('Дата рождения').fill('2000-01-01')

    await page.getByRole('button', { name: /создать аккаунт/i }).click()

    await expect(page).toHaveURL(/\/$/)
  })

  test('регистрация — ошибка при разных паролях', async ({ page }) => {
    await page.goto('/register')

    await page.getByLabel('Email').fill('existing@example.com')
    await page.getByLabel('Пароль', { exact: true }).fill('password123')
    await page.getByLabel('Подтвердите пароль').fill('different-password')
    await page.getByLabel('ФИО').fill('Иван Иванов')
    await page.getByLabel('Дата рождения').fill('2000-01-01')

    await page.getByRole('button', { name: /создать аккаунт/i }).click()

    await expect(page.getByText(/пароли не совпадают/i)).toBeVisible()
  })

  test('регистрация — ошибка при уже существующем email', async ({ page }) => {
    await page.route('**/api/v1/auth/register', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Email already exists',
        }),
      })
    })

    await page.goto('/register')

    await page.getByLabel('Email').fill('existing@example.com')
    await page.getByLabel('Пароль', { exact: true }).fill('password123')
    await page.getByLabel('Подтвердите пароль').fill('password123')
    await page.getByLabel('ФИО').fill('Иван Иванов')
    await page.getByLabel('Дата рождения').fill('2000-01-01')

    await page.getByRole('button', { name: /создать аккаунт/i }).click()

    await expect(page.getByText(/email уже занят/i)).toBeVisible()
  })

  test('валидация входа — пустые поля', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /войти/i }).click()

    await expect(page.getByText(/укажите email/i)).toBeVisible()
    await expect(page.getByText(/укажите пароль/i)).toBeVisible()
  })

  test('валидация входа — некорректный email', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByRole('button', { name: /войти/i }).click()

    await expect(page.getByText(/введите корректный email/i)).toBeVisible()
  })

  test('валидация регистрации — пустые поля', async ({ page }) => {
    await page.goto('/register')

    await page.getByRole('button', { name: /создать аккаунт/i }).click()

    await expect(page.getByText(/укажите email/i)).toBeVisible()
    await expect(page.getByText(/укажите пароль/i)).toBeVisible()
    await expect(page.getByText(/укажите фио/i)).toBeVisible()
    await expect(page.getByText(/укажите дату рождения/i)).toBeVisible()
  })
})



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

function mockMemberGrades(
  page: import('@playwright/test').Page,
  courseId: string,
  userId: string,
  items: object[] = [],
) {
  return page.route(
    `**/api/v1/courses/${courseId}/members/${userId}/grades`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(items),
      }),
  )
}

/** Мок комментариев — endpoint assignments/{id}/comments используется и для постов (id = postId) */
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
      await expect(page.getByRole('tab', { name: /настройки класса/i })).not.toBeVisible()
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
      await expect(page.getByRole('tab', { name: /настройки класса/i })).toBeVisible()
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

      await expect(page.getByRole('button', { name: /пост 1/i })).toBeVisible()
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
      await page.getByRole('tab', { name: /настройки/i }).click()

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

  test.describe('Вкладка Пользователи', () => {
    test('отображение списка с ролями', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-users', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-users', { id: 'c-users', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-users')
      await mockMembers(page, 'c-users', [
        { user_id: 'u-owner', email: 'owner@x.com', first_name: 'Олег', last_name: 'Владелец', role: 'owner' },
        { user_id: 'u-teacher', email: 't@x.com', first_name: 'Татьяна', last_name: 'Преподаватель', role: 'teacher' },
        { user_id: 'u-student', email: 's@x.com', first_name: 'Сергей', last_name: 'Студент', role: 'student' },
      ])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()

      await expect(page.getByText('Олег Владелец')).toBeVisible()
      await expect(page.getByText('роль: владелец')).toBeVisible()
      await expect(page.getByText('Татьяна Преподаватель')).toBeVisible()
      await expect(page.getByText('роль: преподаватель')).toBeVisible()
      await expect(page.getByText('Сергей Студент')).toBeVisible()
      await expect(page.getByText('роль: студент')).toBeVisible()
    })

    test('клик на пользователя открывает профиль', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-profile', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-profile', { id: 'c-profile', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-profile')
      await mockMembers(page, 'c-profile', [
        { user_id: 'u-anna', email: 'anna@x.com', first_name: 'Анна', last_name: 'Петрова', role: 'teacher' },
      ])
      await mockMemberGrades(page, 'c-profile', 'u-anna', [
        {
          submission: { id: 'sub1', assignment_id: 'a1', user_id: 'u-anna', grade: 85, submitted_at: '2024-01-15T12:00:00Z' },
          assignment: { id: 'a1', title: 'Задание 1', deadline: null },
        },
      ])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()
      await page.getByText('Анна Петрова').click()

      const dialog = page.getByRole('dialog', { name: /профиль пользователя/i })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Анна Петрова')).toBeVisible()
      await expect(dialog.getByText('anna@x.com')).toBeVisible()
      await expect(dialog.getByText('Задание 1')).toBeVisible()
      await expect(dialog.getByText('Оценка: 85')).toBeVisible()
    })

    test('Owner — изменить роль, исключить (confirm, update list)', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-owner', title: 'Курс владельца', role: 'owner' }])
      await mockCourse(page, 'c-owner', { id: 'c-owner', title: 'Курс владельца', role: 'owner' })
      await mockFeed(page, 'c-owner')
      await mockInviteCode(page, 'c-owner', 'CODE1234')
      let members: { user_id: string; email: string; first_name: string; last_name: string; role: string }[] = [
        { user_id: 'user-1', email: 'owner@x.com', first_name: 'Я', last_name: 'Владелец', role: 'owner' },
        { user_id: 'u-student', email: 's@x.com', first_name: 'Студент', last_name: 'Тест', role: 'student' },
      ]

      await page.route('**/api/v1/courses/c-owner/members/u-student', async (route) => {
        const req = route.request()
        if (req.method() === 'DELETE') {
          members = members.filter((m) => m.user_id !== 'u-student')
          await route.fulfill({ status: 204 })
        } else if (req.method() === 'PATCH') {
          const body = JSON.parse((await req.postData()) ?? '{}')
          const updated = { ...members.find((m) => m.user_id === 'u-student')!, role: body.role ?? 'teacher' }
          members = members.map((m) => (m.user_id === 'u-student' ? updated : m))
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(updated),
          })
        } else {
          await route.fulfill({ status: 404 })
        }
      })

      await page.route('**/api/v1/courses/c-owner/members', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(members),
          })
        } else {
          route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /курс владельца.*роль: владелец/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()

      await expect(page.getByText('Студент Тест')).toBeVisible()

      await page.getByRole('button', { name: /изменить роль/i }).click()
      await page.getByRole('menuitem', { name: /назначить преподавателем/i }).click()

      await expect(page.getByText('Студент Тест')).toBeVisible()
      await expect(page.getByText('роль: преподаватель')).toBeVisible()

      await page.getByRole('button', { name: /исключить из курса/i }).click()
      await expect(page.getByRole('dialog', { name: /исключить из курса/i })).toBeVisible()
      await page.getByRole('button', { name: 'Исключить' }).click()

      await expect(page.getByText('Студент Тест')).not.toBeVisible()
    })

    test('Teacher — исключить студента', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-teach', title: 'Курс препода', role: 'teacher' }])
      await mockCourse(page, 'c-teach', { id: 'c-teach', title: 'Курс препода', role: 'teacher' })
      await mockFeed(page, 'c-teach')
      await mockInviteCode(page, 'c-teach', 'T123')
      let members: { user_id: string; email: string; first_name: string; last_name: string; role: string }[] = [
        { user_id: 'user-1', email: 't@x.com', first_name: 'Преподаватель', last_name: 'Я', role: 'teacher' },
        { user_id: 'u-st', email: 'st@x.com', first_name: 'Студент', last_name: 'Курса', role: 'student' },
      ]

      await page.route('**/api/v1/courses/c-teach/members/u-st', async (route) => {
        if (route.request().method() === 'DELETE') {
          members = members.filter((m) => m.user_id !== 'u-st')
          await route.fulfill({ status: 204 })
        } else {
          await route.fulfill({ status: 404 })
        }
      })

      await page.route('**/api/v1/courses/c-teach/members', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(members),
          })
        } else {
          route.fallback()
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /курс препода.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()

      await expect(page.getByText('Студент Курса')).toBeVisible()
      await page.getByRole('button', { name: /исключить из курса/i }).click()
      await expect(page.getByRole('dialog', { name: /исключить из курса/i })).toBeVisible()
      await page.getByRole('button', { name: 'Исключить' }).click()

      await expect(page.getByText('Студент Курса')).not.toBeVisible()
    })

    test('Профиль — отображение данных, список заданий, клик на задание', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-p5', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-p5', { id: 'c-p5', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-p5', [
        { type: 'assignment', id: 'a-one', title: 'Задание Один' },
        { type: 'post', id: 'p1', title: 'Пост' },
      ])
      await mockMembers(page, 'c-p5', [
        { user_id: 'u-p5', email: 'user@test.com', first_name: 'Иван', last_name: 'Иванов', birth_date: '1995-05-15', role: 'student' },
      ])
      await mockMemberGrades(page, 'c-p5', 'u-p5', [
        {
          submission: { id: 's1', assignment_id: 'a-one', user_id: 'u-p5', grade: 90, submitted_at: '2024-02-01T10:00:00Z' },
          assignment: { id: 'a-one', title: 'Задание Один', deadline: null },
        },
      ])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()
      await page.getByText('Иван Иванов').click()

      const dialog = page.getByRole('dialog', { name: /профиль пользователя/i })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Иван Иванов')).toBeVisible()
      await expect(dialog.getByText('user@test.com')).toBeVisible()
      await expect(dialog.getByText('Задание Один')).toBeVisible()
      await expect(dialog.getByText('Оценка: 90')).toBeVisible()

      await dialog.getByText('Задание Один').click()
      await expect(page.getByRole('dialog', { name: /профиль пользователя/i })).not.toBeVisible()
      await expect(page.getByText('Задание Один')).toBeVisible()
    })

    test('Student — нет кнопок (no permissions)', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-stu', title: 'Курс студента', role: 'student' }])
      await mockCourse(page, 'c-stu', { id: 'c-stu', title: 'Курс студента', role: 'student' })
      await mockFeed(page, 'c-stu')
      await mockMembers(page, 'c-stu', [
        { user_id: 'user-1', email: 'me@x.com', first_name: 'Я', last_name: 'Студент', role: 'student' },
        { user_id: 'u-other', email: 'other@x.com', first_name: 'Другой', last_name: 'Участник', role: 'student' },
      ])

      await page.goto('/')
      await page.getByRole('button', { name: /курс студента.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /пользователи/i }).click()

      await expect(page.getByText('Я Студент')).toBeVisible()
      await expect(page.getByText('Другой Участник')).toBeVisible()
      await expect(page.getByRole('button', { name: /исключить из курса/i })).not.toBeVisible()
      await expect(page.getByRole('button', { name: /изменить роль/i })).not.toBeVisible()
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

  test.describe('Вкладка Посты', () => {
    test('Тест 1: Список постов — загрузка, клик для просмотра', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-posts', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-posts', { id: 'c-posts', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-posts', [
        {
          type: 'post',
          id: 'post-1',
          title: 'Важное объявление',
          body: 'Содержание поста для студентов.',
          created_at: '2024-03-01T10:00:00Z',
        },
      ])
      await mockMembers(page, 'c-posts', [
        { user_id: 'u1', email: 't@x.com', first_name: 'Анна', last_name: 'Петрова', role: 'teacher' },
      ])
      await mockComments(page, 'c-posts', 'post-1', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await expect(page.getByText('Содержание поста для студентов.')).toBeVisible()

      await page.getByRole('button', { name: /важное объявление/i }).click()

      await expect(page.getByText('Содержание поста для студентов.')).toBeVisible()
      await expect(page.getByText('Добавить комментарий')).toBeVisible()
    })

    test('Тест 2: Создание поста — заполнение формы, прикрепление файлов, отправка', async ({
      page,
    }) => {
      let feedItems: object[] = [
        { type: 'post', id: 'p0', title: 'Старый пост', body: 'Текст', created_at: '2024-01-01T00:00:00Z' },
      ]
      await mockCourseList(page, [{ id: 'c-create', title: 'Курс', role: 'teacher' }])
      await mockCourse(page, 'c-create', { id: 'c-create', title: 'Курс', role: 'teacher' })
      await mockInviteCode(page, 'c-create', 'CODE1234')

      await page.route('**/api/v1/courses/c-create/feed', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(feedItems),
        }),
      )
      await page.route('**/api/v1/courses/c-create/posts', async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse((await route.request().postData()) ?? '{}')
          const newPost = {
            id: 'post-new',
            course_id: 'c-create',
            title: body.title ?? 'Новый пост',
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
          await route.fulfill({ status: 404 })
        }
      })

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: преподаватель/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await page.getByRole('button', { name: /новое объявление|создать пост/i }).click()

      const dialog = page.getByRole('dialog', { name: /новый пост/i })
      await expect(dialog).toBeVisible()

      await dialog.getByLabel('Заголовок поста').fill('Новый пост для класса')
      await dialog.getByLabel('Содержание поста').fill('Содержание нового поста')
      await dialog.getByLabel('Ссылки').fill('https://example.com')

      await dialog.getByRole('button', { name: /прикрепить файлы/i }).click()
      await page.getByLabel('Прикрепить файлы').setInputFiles({
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('test content'),
      })

      await expect(dialog.getByText('document.pdf')).toBeVisible()

      await dialog.getByRole('button', { name: 'Создать' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(page.getByText('Новый пост для класса')).toBeVisible()
    })

    test('Тест 3: Просмотр поста — содержимое, файлы', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-view', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-view', { id: 'c-view', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-view', [
        {
          type: 'post',
          id: 'post-with-files',
          title: 'Пост с вложениями',
          body: 'Текст поста с файлами.',
          created_at: '2024-03-01T10:00:00Z',
          attachments: [
            { id: 'att-1', name: 'lecture.pdf', type: 'application/pdf' },
            { id: 'att-2', name: 'image.png', type: 'image/png' },
          ],
        },
      ])
      await mockMembers(page, 'c-view', [])
      await mockComments(page, 'c-view', 'post-with-files', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await page.getByRole('button', { name: /пост с вложениями/i }).click()

      await expect(page.getByText('Текст поста с файлами.')).toBeVisible()
      await expect(page.getByText('lecture.pdf')).toBeVisible()
      await expect(page.getByText('image.png')).toBeVisible()
    })

    test('Тест 4: Добавление комментария — текст + файл, отправка', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-comment', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-comment', { id: 'c-comment', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-comment', [
        {
          type: 'post',
          id: 'post-comment',
          title: 'Пост для комментария',
          body: 'Текст.',
          created_at: '2024-03-01T10:00:00Z',
        },
      ])
      await mockMembers(page, 'c-comment', [])
      await mockComments(page, 'c-comment', 'post-comment', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await page.getByRole('button', { name: /пост для комментария/i }).click()
      await page.getByText('Добавить комментарий').click()

      await page.getByLabel('Текст комментария').fill('Мой комментарий к посту')
      await page.getByRole('button', { name: 'Файл' }).click()
      await page.getByLabel('Прикрепить файл к комментарию').setInputFiles({
        name: 'comment-file.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('comment content'),
      })

      await expect(page.getByText('comment-file.txt')).toBeVisible()

      await page.getByRole('button', { name: 'Отправить' }).click()

      await expect(page.getByText('Комментарии (1)')).toBeVisible()
      await page.getByText('Комментарии (1)').click()
      await expect(page.getByRole('dialog').getByText('Мой комментарий к посту')).toBeVisible()
    })

    test('Тест 5: Роли — студент не видит кнопку создания', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-student', title: 'Курс студента', role: 'student' }])
      await mockCourse(page, 'c-student', { id: 'c-student', title: 'Курс студента', role: 'student' })
      await mockFeed(page, 'c-student', [
        { type: 'post', id: 'p1', title: 'Пост 1', body: 'Текст', created_at: '2024-01-01T00:00:00Z' },
      ])
      await mockMembers(page, 'c-student', [])

      await page.goto('/')
      await page.getByRole('button', { name: /курс студента.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await expect(page.getByText('Пост 1')).toBeVisible()
      await expect(page.getByRole('button', { name: /новое объявление|создать пост/i })).not.toBeVisible()
    })

    test('Тест 6: Attachments handling — отображение вложений', async ({ page }) => {
      await mockCourseList(page, [{ id: 'c-att', title: 'Курс', role: 'student' }])
      await mockCourse(page, 'c-att', { id: 'c-att', title: 'Курс', role: 'student' })
      await mockFeed(page, 'c-att', [
        {
          type: 'post',
          id: 'post-att',
          title: 'Пост с вложениями',
          body: 'Текст поста.',
          created_at: '2024-03-01T10:00:00Z',
          attachments: [
            { id: 'a1', name: 'document.pdf', type: 'application/pdf', url: 'https://example.com/doc.pdf' },
          ],
        },
      ])
      await mockMembers(page, 'c-att', [])
      await mockComments(page, 'c-att', 'post-att', [])

      await page.goto('/')
      await page.getByRole('button', { name: /Курс.*роль: студент/i }).click()
      await page.getByRole('tab', { name: /посты/i }).click()

      await expect(page.getByText('document.pdf')).toBeVisible()

      await page.getByRole('button', { name: /пост с вложениями/i }).click()

      await expect(page.getByRole('heading', { name: 'Вложения', exact: true })).toBeVisible()
      await expect(page.getByText('document.pdf')).toBeVisible()
    })
  })
})

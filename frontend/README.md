## hits-classroom

Фронтенд-проект аналога Google Classroom для ХИТС с упором на TDD‑разработку.

### Стек

- **React + TypeScript + Vite**
- **MUI (Material UI)** для UI‑компонентов
- **Tailwind CSS** для быстрой стилизации и layout-а
- **Playwright (@playwright/test)** для e2e‑тестов и TDD

### Установка

```bash
yarn
```

### Скрипты

- **Разработка**: `yarn dev`
- **Сборка**: `yarn build`
- **Предпросмотр билда**: `yarn preview`
- **Линтер**: `yarn lint`
- **PW‑тесты**: `yarn test:pw`
- **PW в UI‑режиме**: `yarn test:pw:ui`

Перед первым запуском pw‑тестов установите браузеры Playwright:

```bash
yarn playwright install
```
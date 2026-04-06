# Патч-ноут для фронтенда: групповые задания и команды (API 0.5.x)

Документ описывает **весь** контракт и поведение, которое нужно отразить в UI. Его можно **целиком вставить в промпт** к агенту/разработчику с формулировкой: «Реализуй описанное ниже в существующем React-приложении (курсы/задания), следуя текущим паттернам RTK Query / компонентов проекта».

**Источник правды:** `api-spec.yaml` (версия API в `info.version`, базовый путь `servers[0].url`, обычно `/api/v1`). Все пути ниже — относительно этого префикса.

**Авторизация:** везде `Authorization: Bearer <JWT>`, кроме публичных эндпоинтов.

---

## 0. Мастер-промпт (одним блоком)

```
Ты — фронтенд этого репозитория. Нужно внедрить поддержку групповых заданий и команд по REST API hits-classroom 0.5.x.

Обязательно:
1) Расширить типы задания (Assignment) и форму создания/редактирования задания всеми полями из раздела «Модель задания» документа docs/frontend-patch-note-teams-module.md.
2) Для assignment_kind === "group" показывать блок «Команды»: список команд с участниками, статусом команды, действиями в зависимости от роли (student / teacher|owner) и team_distribution_type, team_submission_rule, team_grading_mode, roster_locked_at, deadline.
3) Добавить RTK Query (или аналог) эндпоинты из раздела «Каталог HTTP» того же файла; обрабатывать 400 с телом { error, code } и показывать message/error пользователю.
4) Сценарии сдачи: first / last / top_student / vote_equal / vote_weighted — вести студента по разным UX-потокам (см. «Правила сдачи»).
5) Режимы оценивания: individual / team_uniform / team_peer_split — разные экраны выставления оценки (см. «Оценивание»).
6) Не ломать индивидуальные задания (assignment_kind === "individual" или отсутствует — вести себя как сейчас).

Сверяйся только с docs/frontend-patch-note-teams-module.md и api-spec.yaml; не выдумывай поля.
```

---

## 1. Модель задания (расширение Assignment)

### 1.1. Поля в ответах GET/PATCH и в объекте после POST создания

| Поле | Тип | Смысл для UI |
|------|-----|----------------|
| `assignment_kind` | `"individual"` \| `"group"` | Если `group` — включается вся логика команд. |
| `desired_team_size` | number | Желаемый размер команды; число команд ≈ ceil(студенты / desired_team_size). |
| `team_distribution_type` | enum | Как формируются команды: см. §2. |
| `team_count` | number | Сохранённое/legacy число команд. |
| `max_team_size` | number | Потолок участников в команде (сервер считает). |
| `team_submission_rule` | enum | Как выбирается «официальная» сдача команды: см. §3. |
| `vote_tie_break` | enum | При равенстве голосов: `random` \| `highest_author_average`. |
| `allow_early_finalization` | boolean | Можно ли до дедлайна: прикрепить финальную сдачу (не vote) / вызвать finalize-vote. |
| `team_grading_mode` | enum | Как преподаватель ставит оценку: см. §4. |
| `peer_split_min_percent` / `peer_split_max_percent` | number | Допустимый диапазон долей для peer split (0–100, min ≤ max). |
| `roster_locked_at` | date-time \| null | Если не null — состав заблокирован (нельзя create/join/leave, кроме логики сервера). |
| `deadline_auto_finalized_at` | date-time \| null | Авто-обработка дедлайна уже отработала (информативно). |

### 1.2. Поля при создании задания (CreateAssignmentRequest)

Помимо уже существующих (`title`, `body`, `links`, `file_ids`, `deadline`, `max_grade`) отправлять при групповом задании:

- `assignment_kind`: `"group"`
- `team_distribution_type`
- `desired_team_size` (рекомендуется, min 2 в спецификации) **или** `team_count` (>0) — для группового нужно что-то одно осмысленное (сервер: «group assignment requires desired_team_size >= 2 or team_count > 0»).
- Опционально: `team_submission_rule`, `vote_tie_break`, `allow_early_finalization`, `team_grading_mode`, `peer_split_min_percent`, `peer_split_max_percent`.

**Валидация на фронте (дублировать сервер):**

- Для `team_grading_mode === "team_peer_split"` и группового задания: задать min/max процентов в [0,100], min ≤ max.
- Для `team_grading_mode === "team_uniform"` — только групповое задание.
- Индивидуальное задание: не отправлять peer_split / team_uniform (сервер отклонит).

---

## 2. Перечисления (enums) — что показывать пользователю

### 2.1. `TeamDistributionType`

| Значение | Кто управляет составом | UI преподавателя | UI студента |
|----------|------------------------|------------------|-------------|
| `free` | Студенты сами | Кнопка «Заблокировать состав» (`lock-roster`), просмотр команд | Создать команду (POST teams), вступить (join), выйти (leave) — пока нет блокировки |
| `manual` | Преподаватель | Редактор состава → POST `teams/save` | Только просмотр |
| `random` | Преподаватель | POST `generate-random`, при необходимости правка через `save` | Просмотр |
| `balanced` | Преподаватель | POST `generate-balanced`, при необходимости `save` | Просмотр |

### 2.2. `TeamSubmissionRule`

| Значение | Поведение (важно для кнопок «Отправить финально») |
|----------|-----------------------------------------------------|
| `first_submission` | Первый участник команды, прикрепивший работу, «закрывает» команду; остальные не могут финально сдать, пока не снято (detach / return). |
| `last_submission` | Финальная сдача одного участника **открепляет** (`is_attached=false`) финальные сдачи остальных членов команды (сервер делает сам). |
| `top_student_only` | Финально сдать может только участник с лучшим нормализованным средним баллом по курсу (остальным 403). |
| `vote_equal` | Финальная сдача через голосование: студенты голосуют за `submission_id`; финальный прикреп — через POST `finalize-vote` (преподаватель) или автодедлайн. Прямой POST submissions с `is_attached=true` для группы **запрещён** (400: use voting finalize endpoint). |
| `vote_weighted` | То же по API голоса (`submission_id`); вес голоса считает сервер (баллы за прошлые работы). |

### 2.3. `VoteTieBreak`

- `random` — случайный выбор среди лидеров.
- `highest_author_average` — победитель среди лидеров по среднему баллу автора сабмишена.

### 2.4. `TeamGradingMode`

| Значение | UI оценки |
|----------|-----------|
| `individual` | Как сейчас: PUT `submissions/{id}/grade` по каждому ответу. |
| `team_uniform` | PUT grade на **любой** сабмишен члена команды — сервер **протянет** ту же оценку и комментарий остальным членам команды. |
| `team_peer_split` | Нельзя использовать PUT `.../grade` для выставления (400). Студенты заполняют проценты → POST `peer-grade-split`; преподаватель вводит одну оценку команды → POST `grade-peer-split`. |

---

## 3. Правила сдачи (детально для UX)

Общее:

- Для **группового** задания студент **должен быть в команде**, иначе сабмишн недоступен (403).
- `is_attached: false` — черновик (можно обновлять тем же POST).
- `is_attached: true` — финальная сдача; после `deadline` финальная сдача невозможна (409).
- Если `allow_early_finalization === false` и есть дедлайн, и правило **не** vote_*: финальную сдачу нельзя до дедлайна (400: `final submission is not allowed before deadline`).
- Для vote_* при `allow_early_finalization === false` финализация голоса преподавателем до дедлайна тоже ограничена сервером (`finalize not allowed before deadline`).

**Голосование:**

- POST `.../teams/{teamId}/votes` body: `{ "submission_id": "<uuid>" }`.
- Список кандидатов для голосования — это прикреплённые/необходимые сабмишены членов команды; удобно брать из GET списка сабмишенов (преподаватель видит все) или агрегировать по членам команды из `list teams` + индивидуальные сабмишены.

**Finalize голоса (преподаватель):**

- POST `.../teams/{teamId}/finalize-vote` → 200 + тело `Submission` победителя (прикреплённый).

---

## 4. Оценивание (детально)

- **individual:** обычный PUT `.../submissions/{submissionId}/grade` с `grade`, `grade_comment`.
- **team_uniform:** один PUT grade по одному submission — остальные обновятся на сервере; показать преподавателю подсказку «оценка применится ко всей команде».
- **team_peer_split:**
  1. Студент (участник команды): POST `.../teams/{teamId}/peer-grade-split` body `{ "percents": { "<user_id>": 25.5, ... } }` — сумма 100 ± 0.01, каждый процент внутри [min,max] задания.
  2. Преподаватель: POST `.../teams/{teamId}/grade-peer-split` body `{ "grade": N, "grade_comment": "..." }` — после того как команда отправила split (сервер проверит полноту).

---

## 5. Поле `status` у команды (TeamWithMembers)

Строка для бейджа/степпера. Значения из спеки (описание в `TeamWithMembers.status`):

`forming` | `roster_locked` | `voting_open` | `voting` | `submitted` | `graded` | `not_submitted`

Использовать для:

- подписи к карточке команды;
- подсказок «что делать дальше» студенту/преподавателю.

---

## 6. Каталог HTTP (метод, путь, роль, тело, ответ)

Все пути: `/courses/{courseId}/assignments/{assignmentId}/...` (uuid в пути).

| Метод | Путь | Кто | Тело | Успех |
|-------|------|-----|------|--------|
| GET | `.../teams` | member курса | — | `TeamWithMembers[]` |
| POST | `.../teams` | student | `{ name? }` | `Team` 201 |
| POST | `.../teams/save` | teacher/owner | `SaveTeamsRequest`: `{ teams: [{ name, member_ids: uuid[] }] }` | 204 |
| POST | `.../teams/generate-random` | teacher/owner | — | 204 |
| POST | `.../teams/generate-balanced` | teacher/owner | — | 204 |
| POST | `.../teams/{teamId}/join` | student | — | 204 |
| POST | `.../teams/leave` | student | — | 204 |
| DELETE | `.../teams/leave` | student | — | 204 |
| POST | `.../teams/{teamId}/votes` | student (в команде) | `{ submission_id }` | 204 |
| POST | `.../teams/{teamId}/finalize-vote` | teacher/owner | — | 200 `Submission` |
| POST | `.../teams/lock-roster` | teacher/owner | — | 204 |
| GET | `.../teams/audit?team_id=&limit=&offset=` | teacher/owner | — | `TeamAuditEvent[]` |
| POST | `.../teams/{teamId}/peer-grade-split` | student | `PeerGradeSplitRequest` | 204 |
| POST | `.../teams/{teamId}/grade-peer-split` | teacher/owner | `GradeTeamPeerSplitRequest` | 204 |

**Сабмишены (связано с командами):**

| Метод | Путь | Примечание |
|-------|------|------------|
| POST | `.../submissions` | `CreateSubmissionRequest`; для vote_* финал только через finalize-vote |
| GET | `.../submissions` | teacher — все; student — фактически свой |
| GET | `.../submissions/my` | свой ответ |
| PUT | `.../submissions/{id}/grade` | не использовать для `team_peer_split` |
| PUT | `.../assignments/{assignmentId}/detach` | тело `DetachSubmissionRequest` `{ user_id }` — открепить чужую финальную сдачу (teacher) |

---

## 7. Объекты JSON (кратко)

**TeamMemberInfo:** `user_id`, `first_name`, `last_name`, `average_score` (float, нормализованное среднее для подсказок / top_student / weighted vote).

**Team:** `id`, `assignment_id`, `creator_id`, `name`, `max_members`, `created_at`.

**TeamWithMembers:** поля Team + `members: TeamMemberInfo[]`, `status: string`.

**TeamAuditEvent:** `id`, `assignment_id`, `team_id`, `actor_user_id`, `event_type`, `payload` (object), `created_at` — для модалки «История» у преподавателя.

---

## 8. Ошибки и краевые случаи (показать текст)

Типичные сообщения сервера (через 400 `error` / `ValidationError`):

- «group assignment requires desired_team_size >= 2 or team_count > 0»
- «final submission is not allowed before deadline»
- «use voting finalize endpoint for this assignment»
- «use POST .../teams/{teamId}/grade-peer-split for this assignment»
- «team roster is locked»
- «finalize not allowed before deadline»
- «peer split is not enabled...» / «team has not submitted peer split yet» / проценты не сходятся в 100

**409** на финальную сдачу: дедлайн или уже финально отправлено.

---

## 9. Рекомендуемая структура UI (чеклист экранов)

1. **Создание/редактирование задания (teacher):** секция «Тип: индивидуальное / групповое»; при групповом — все поля §1.2 с подсказками; disabled комбинации (peer_split на индивидуальном).
2. **Карточка задания в курсе:** бейдж «Групповое», кратко: правило сдачи, дедлайн, заблокирован ли состав.
3. **Страница задания — студент:** блок «Моя команда» (или CTA создать/вступить); действия по `team_distribution_type`; черновик/финал сабмишена с учётом §3; для vote — UI выбора работы и индикация голосов; для peer_split — матрица процентов с валидацией суммы.
4. **Страница задания — преподаватель:** таблица команд + `status`; кнопки generate/save/lock; аудит; для vote — finalize по команде; оценки по режиму §4.
5. **Поллинг / инвалидация кэша:** после операций с командами инвалидировать теги `Assignment`, `Teams`, `Submissions`.

---

## 10. Замечания по F-TEAMS-19

Отдельный продуктовый тон: **файлы и листинг сабмишенов строго в контексте «команда»** в API может быть не выделен отдельным эндпоинтом — используйте `GET teams` + `GET submissions` (роль teacher) + связку по `user_id` членов. Уточняйте у бэкенда/ПМ при появлении отдельного контракта.

---

## 11. Версионирование

Перед началом работ сверить `info.version` в `api-spec.yaml`. При смене версии перегенерировать типы или обновить ручные интерфейсы TypeScript под схемы в `components/schemas`.

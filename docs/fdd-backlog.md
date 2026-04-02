# FDD: модуль команд и групповых заданий (hits-classroom)

## Шаблон описания фичи (копировать в ПМку)

- **ID фичи:** F-TEAMS-XX  
- **Бизнес-цель:**  
- **Границы (in / out):**  
- **Сценарии:**  
- **Зависимости:**  
- **Definition of Done:**  

## Задачи на фичу (подзадачи в ПМке)

1. Спроектировать F-TEAMS-XX  
2. Реализовать F-TEAMS-XX  
3. Протестировать F-TEAMS-XX  

## Соглашение по коммитам

`feat(F-TEAMS-XX): краткое описание` · `fix` · `docs` · `chore` — по смыслу.

---

## Реестр фич

| ID | Название | Статус в коде* | Примечание |
|----|----------|----------------|------------|
| F-TEAMS-01 | Модель группового задания (домен + GORM) | реализовано | assignment_kind, desired_team_size, поля FR-GA |
| F-TEAMS-02 | API создания задания с параметрами команд | реализовано | POST + assignmentResponse |
| F-TEAMS-03 | Таблицы Team / TeamMember, bulk replace | реализовано | |
| F-TEAMS-04 | GET команды + участники + средний балл | реализовано | teacher/student |
| F-TEAMS-05 | Free: create / join / leave | реализовано | |
| F-TEAMS-06 | Manual: сохранить все команды | реализовано | POST save |
| F-TEAMS-07 | Random: распределение | реализовано | POST generate-random |
| F-TEAMS-08 | Balanced: snake по баллам | реализовано | POST generate-balanced |
| F-TEAMS-09 | Сдача: first / last / top_student | реализовано | CreateSubmission + дедлайн |
| F-TEAMS-10 | Голосование equal / weighted | реализовано | vote + finalize |
| F-TEAMS-11 | Ничья голосов: tie-break | реализовано | vote_tie_break |
| F-TEAMS-12 | Автофиксация по дедлайну | реализовано | тикер API + cmd/deadline-worker |
| F-TEAMS-13 | allow_early_finalization | реализовано | |
| F-TEAMS-14 | Блокировка состава (roster lock) | реализовано | POST lock + после дедлайна |
| F-TEAMS-15 | Оценки: individual / uniform / peer_split | реализовано | |
| F-TEAMS-16 | Аудит команд | реализовано | GET audit |
| F-TEAMS-17 | Статус команды в списке | реализовано | поле status |
| F-TEAMS-18 | OpenAPI / контракт | реализовано | api-spec.yaml 0.5.x |
| F-TEAMS-19 | Файлы и листинг сабмишенов в team-контексте | уточнить | согласовать с Димой |

\*Статус «реализовано» — по текущему состоянию репозитория; в ПМке можно вести свои статусы (К выполнению / Готово).

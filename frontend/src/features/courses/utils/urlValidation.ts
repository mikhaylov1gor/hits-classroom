/**
 * Регулярное выражение для валидации URL.
 * Поддерживает http/https, домены (в т.ч. localhost), IP, путь, query и fragment.
 * TLD (.com и т.д.) опционален — для localhost и IP-адресов.
 */
const URL_REGEX =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}(\.[a-zA-Z0-9()]{1,6}\b)?([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i

/**
 * Проверяет, является ли строка валидным URL (по regex).
 * Если протокол не указан, добавляется https://
 */
export function isValidUrl(str: string): boolean {
  const trimmed = str.trim()
  if (!trimmed) return false
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return URL_REGEX.test(withProtocol)
}

/**
 * Парсит body ответа (хранит ссылки/значения, разделённые переносом строки или др.) и возвращает массив.
 */
export function parseSubmissionBodyLinks(body: string | null | undefined): string[] {
  if (!body || typeof body !== 'string') return []
  return body
    .replace(/\\n/g, '\n')
    .split(/[\n\r;,|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Возвращает href для ссылки (добавляет https:// если нет протокола).
 */
export function getLinkHref(url: string): string {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

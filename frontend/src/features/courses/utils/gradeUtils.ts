/**
 * Форматирует оценку для отображения.
 * Если maxGrade === 1 — зачёт/незачёт.
 * Иначе — числовая шкала (X из Y).
 */
export function formatGradeDisplay(grade: number, maxGrade: number): string {
  if (maxGrade === 1) {
    return grade >= 1 ? 'Зачёт' : 'Не зачёт'
  }
  return `${grade} из ${maxGrade}`
}

/** Проверяет, используется ли режим зачёт/незачёт (maxGrade === 1) */
export function isPassFailGrading(maxGrade: number): boolean {
  return maxGrade === 1
}

import type { Criterion, GradingTemplate } from '../../../shared/types/grading'

const now = new Date().toISOString()

export const seedCriterionLibrary: Criterion[] = [
  {
    id: 'library_on_time',
    title: 'Сдано вовремя',
    type: 'pass_fail',
    passed: true,
  },
  {
    id: 'library_theory',
    title: 'Теория',
    type: 'points',
    maxScore: 40,
    score: 32,
  },
  {
    id: 'library_practice',
    title: 'Практика',
    type: 'points',
    maxScore: 60,
    score: 48,
  },
  {
    id: 'library_team_contribution',
    title: 'Командный вклад',
    type: 'points',
    maxScore: 20,
    score: 16,
    conditionBehavior: 'hide',
    conditions: [
      {
        operator: 'AND',
        conditions: [
          {
            type: 'assignment_field',
            left: { source: 'assignment_field', field: 'assignment_kind' },
            operator: '=',
            right: { source: 'constant', value: 'group' },
          },
        ],
      },
    ],
  },
]

export const seedTemplates: GradingTemplate[] = [
  {
    id: 'template_individual_default',
    title: 'Individual starter',
    preset: 'individual',
    createdAt: now,
    updatedAt: now,
    criteria: [
      { id: 'c_on_time', title: 'Сдано вовремя', type: 'pass_fail', passed: true },
      { id: 'c_theory', title: 'Теория', type: 'points', maxScore: 40, score: 32 },
      { id: 'c_practice', title: 'Практика', type: 'points', maxScore: 60, score: 48 },
    ],
    modifiers: [
      {
        id: 'm_late_penalty_subset',
        title: 'Штраф за опоздание по теории и практике',
        enabled: true,
        condition: {
          type: 'assignment_field',
          left: { source: 'assignment_field', field: 'deadline' },
          operator: 'before',
          right: { source: 'runtime', key: 'submissionDate' },
        },
        target: { type: 'criteria', criterionIds: ['c_theory', 'c_practice'] },
        effect: {
          type: 'subtract',
          valueSource: { type: 'runtime', fieldKey: 'latePenaltyPoints' },
        },
      },
      {
        id: 'm_failed_on_time_multiplier',
        title: 'Умножить работу на 0.4, если не сдано вовремя',
        enabled: false,
        condition: {
          type: 'criterion',
          criterionId: 'c_on_time',
          operator: '=',
          compareValue: false,
        },
        target: { type: 'criteria', criterionIds: ['c_theory', 'c_practice'] },
        effect: {
          type: 'multiply',
          multiplierSource: { type: 'constant', value: 0.4 },
        },
      },
    ],
  },
  {
    id: 'template_group_default',
    title: 'Group starter',
    preset: 'group',
    createdAt: now,
    updatedAt: now,
    criteria: [
      { id: 'g_theory', title: 'Теория', type: 'points', maxScore: 30, score: 24 },
      { id: 'g_practice', title: 'Практика', type: 'points', maxScore: 50, score: 42 },
      {
        id: 'g_team_contribution',
        title: 'Командный вклад',
        type: 'points',
        maxScore: 20,
        score: 16,
        conditionBehavior: 'hide',
        conditions: [
          {
            operator: 'AND',
            conditions: [
              {
                type: 'assignment_field',
                left: { source: 'assignment_field', field: 'assignment_kind' },
                operator: '=',
                right: { source: 'constant', value: 'group' },
              },
            ],
          },
        ],
      },
    ],
    modifiers: [
      {
        id: 'g_team_size_multiplier',
        title: 'Множитель при неполной команде',
        enabled: true,
        condition: {
          type: 'assignment_field',
          left: { source: 'assignment_field', field: 'team_count' },
          operator: '<',
          right: { source: 'assignment_field', field: 'desired_team_size' },
        },
        target: { type: 'total' },
        effect: {
          type: 'multiply',
          multiplierSource: { type: 'runtime', fieldKey: 'runtimeMultiplier' },
        },
      },
    ],
  },
]

import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  type AccountingPeriodAction,
  isAccountingTransitionAllowed,
} from '../../server/utils/accounting-transitions'

type Case = [
  string,
  AccountingPeriodAction,
  boolean,
]

const cases: Case[] = [
  [
    'OPEN',
    'START_REVIEW',
    true,
  ],

  [
    'OPEN',
    'PRE_CLOSE',
    false,
  ],

  [
    'OPEN',
    'CLOSE',
    false,
  ],

  [
    'OPEN',
    'REOPEN',
    false,
  ],

  [
    'REVIEW',
    'START_REVIEW',
    false,
  ],

  [
    'REVIEW',
    'PRE_CLOSE',
    true,
  ],

  [
    'REVIEW',
    'CLOSE',
    false,
  ],

  [
    'PRE_CLOSED',
    'CLOSE',
    true,
  ],

  [
    'PRE_CLOSED',
    'REOPEN',
    true,
  ],

  [
    'CLOSED',
    'REOPEN',
    true,
  ],

  [
    'CLOSED',
    'CLOSE',
    false,
  ],
]

describe(
  'Transitions des périodes comptables',
  () => {
    it.each(cases)(
      '%s + %s => %s',
      (
        status,
        action,
        expected,
      ) => {
        expect(
          isAccountingTransitionAllowed(
            status,
            action,
          ),
        ).toBe(expected)
      },
    )
  },
)

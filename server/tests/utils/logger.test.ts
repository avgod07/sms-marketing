import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import { logInfo } from '../../utils/logger.util'

vi.mock('fs')

describe('logger', () => {
  it('writes log line', () => {
    const appendFileSync = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {})
    logInfo('test message')
    expect(appendFileSync).toHaveBeenCalled()
  })
})

import { ApiKeyPoolState, ApiProviderCategory, ApiKeyItem } from '../types'

const LS_KEY_POOL = 'ap_smooth_client_keypool_v3'
const LS_LEGACY_POOL = 'ap_smooth_api_key_pool_v2'

/**
 * Initial state with legacy key migration
 */
function getInitialPoolState(): ApiKeyPoolState {
  // Check if legacy key pool exists in localStorage to preserve the user's Groq key
  try {
    const legacyRaw = localStorage.getItem(LS_LEGACY_POOL)
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw)
      if (Array.isArray(parsed.groq) || Array.isArray(parsed.gemini)) {
        return {
          gemini: Array.isArray(parsed.gemini) ? parsed.gemini : [],
          groq: Array.isArray(parsed.groq) ? parsed.groq : [],
          activeCategory: parsed.activeCategory || 'groq',
        }
      }
    }
  } catch {
    // ignore
  }

  // Default empty pools (User configures via Settings Modal / LocalStorage)
  const envGroqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY ? String(import.meta.env.VITE_GROQ_API_KEY).trim() : ''

  return {
    groq: envGroqKey
      ? [
          {
            id: 'groq_env_primary',
            key: envGroqKey,
            label: 'Groq Environment Key',
            category: 'groq',
            isActive: true,
            failCount: 0,
            isExhausted: false,
          },
        ]
      : [],
    gemini: [],
    activeCategory: 'groq',
  }
}

/**
 * Load pool state from browser localStorage
 */
export function getApiKeyPoolState(): ApiKeyPoolState {
  try {
    const raw = localStorage.getItem(LS_KEY_POOL)
    if (raw) {
      const parsed = JSON.parse(raw) as ApiKeyPoolState
      return {
        gemini: Array.isArray(parsed.gemini) ? parsed.gemini : [],
        groq: Array.isArray(parsed.groq) ? parsed.groq : [],
        activeCategory: parsed.activeCategory || 'groq',
      }
    }
  } catch (err) {
    console.warn('[ApiKeyRotator] Error parsing local storage pool:', err)
  }

  const initial = getInitialPoolState()
  saveApiKeyPoolState(initial)
  return initial
}

/**
 * Save pool state to browser localStorage
 */
export function saveApiKeyPoolState(state: ApiKeyPoolState): void {
  try {
    localStorage.setItem(LS_KEY_POOL, JSON.stringify(state))
  } catch (err) {
    console.error('[ApiKeyRotator] Failed to save pool to localStorage:', err)
  }
}

/**
 * Add single or multiple keys (split by comma, newline, or space)
 */
export function addKeysToCategory(
  category: ApiProviderCategory,
  input: string,
  labelPrefix?: string
): ApiKeyPoolState {
  const state = getApiKeyPoolState()
  const rawTokens = input
    .split(/[\n,;\s]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 5)

  const existingSet = new Set(state[category].map((k) => k.key))
  const newItems: ApiKeyItem[] = []

  rawTokens.forEach((token, idx) => {
    if (!existingSet.has(token)) {
      existingSet.add(token)
      newItems.push({
        id: `${category}_${Date.now()}_${idx}`,
        key: token,
        label: labelPrefix ? `${labelPrefix} #${state[category].length + idx + 1}` : undefined,
        category,
        isActive: true,
        failCount: 0,
        isExhausted: false,
      })
    }
  })

  state[category] = [...state[category], ...newItems]
  saveApiKeyPoolState(state)
  return state
}

/**
 * Remove key from category
 */
export function removeKeyFromCategory(
  category: ApiProviderCategory,
  keyId: string
): ApiKeyPoolState {
  const state = getApiKeyPoolState()
  state[category] = state[category].filter((k) => k.id !== keyId)
  saveApiKeyPoolState(state)
  return state
}

/**
 * Toggle key active status
 */
export function toggleKeyStatus(
  category: ApiProviderCategory,
  keyId: string,
  isActive: boolean
): ApiKeyPoolState {
  const state = getApiKeyPoolState()
  state[category] = state[category].map((k) => (k.id === keyId ? { ...k, isActive } : k))
  saveApiKeyPoolState(state)
  return state
}

/**
 * Reset all exhausted statuses for a category
 */
export function resetCategoryPool(category: ApiProviderCategory): ApiKeyPoolState {
  const state = getApiKeyPoolState()
  state[category] = state[category].map((k) => ({
    ...k,
    failCount: 0,
    isExhausted: false,
  }))
  saveApiKeyPoolState(state)
  return state
}

/**
 * Get active non-exhausted keys sorted by least fail count
 */
export function getActiveKeysForCategory(category: ApiProviderCategory): string[] {
  const state = getApiKeyPoolState()
  return state[category]
    .filter((k) => k.isActive && !k.isExhausted)
    .sort((a, b) => a.failCount - b.failCount)
    .map((k) => k.key)
}

/**
 * Mark a key as failed or quota exhausted in localStorage
 */
export function markKeyFailureInStorage(
  category: ApiProviderCategory,
  keyString: string,
  isQuotaExceeded = false
): void {
  const state = getApiKeyPoolState()
  state[category] = state[category].map((k) => {
    if (k.key === keyString) {
      const newFails = k.failCount + 1
      return {
        ...k,
        failCount: newFails,
        isExhausted: isQuotaExceeded ? true : newFails >= 3,
        lastUsedAt: Date.now(),
      }
    }
    return k
  })
  saveApiKeyPoolState(state)
}

/**
 * SMART AUTOMATIC KEY ROTATOR & FAILOVER EXECUTOR
 * Automatically rotates across available keys when encountering 429 Quota Exceeded or 401/403.
 */
export async function executeWithKeyRotation<T>(
  category: ApiProviderCategory,
  taskFn: (apiKey: string) => Promise<T>
): Promise<T> {
  const keys = getActiveKeysForCategory(category)

  if (keys.length === 0) {
    throw new Error(
      `ไม่มี API Key ที่พร้อมใช้งานในกลุ่ม ${category.toUpperCase()}\n\nกรุณากดที่ปุ่ม Settings (⚙) เพื่อเพิ่มหรือเปิดใช้งาน API Key`
    )
  }

  let lastError: Error | null = null

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    console.log(`[Client AI Rotator] Calling ${category.toUpperCase()} with key #${i + 1}/${keys.length}...`)

    try {
      const result = await taskFn(key)
      console.log(`[Client AI Rotator] Key #${i + 1} succeeded!`)
      return result
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError = error
      const msg = error.message

      const isQuotaExceeded = msg.includes('429') || msg.includes('quota') || msg.includes('limit')
      const isInvalidKey = msg.includes('401') || msg.includes('403') || msg.includes('invalid') || msg.includes('API_KEY_INVALID')

      if (isQuotaExceeded || isInvalidKey) {
        console.warn(`[Client AI Rotator] Key #${i + 1} failed (${isQuotaExceeded ? 'Quota 429' : 'Invalid 401'}). Rotating to next key...`)
        markKeyFailureInStorage(category, key, isQuotaExceeded)
        // Continue to next key in loop!
      } else {
        // If it's a general network or unrecoverable error, rethrow immediately
        throw error
      }
    }
  }

  throw new Error(
    `ทุก API Key ในกลุ่ม ${category.toUpperCase()} ถูกใช้งานจนเต็มโควต้าหมดแล้ว (${keys.length} คีย์)\n\nกรุณาเพิ่ม Key สำรองใหม่ในปุ่ม Settings (⚙)`
  )
}

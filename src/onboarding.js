const ONBOARDING_KEY = 'coupure_onboarding_v1'

function getDefaultOnboardingState() {
  return {
    seen: false,
    completedAt: null,
    habitSeeded: false,
    permissionStepShown: false,
  }
}

function sanitizeOnboardingState(input) {
  const state = input ?? {}
  return {
    seen: state.seen === true,
    completedAt: typeof state.completedAt === 'string' ? state.completedAt : null,
    habitSeeded: state.habitSeeded === true,
    permissionStepShown: state.permissionStepShown === true,
  }
}

export function loadOnboardingState() {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    if (!raw) return getDefaultOnboardingState()
    return sanitizeOnboardingState(JSON.parse(raw))
  } catch {
    return getDefaultOnboardingState()
  }
}

export function saveOnboardingState(state) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(sanitizeOnboardingState(state)))
}

export function resetOnboardingState() {
  saveOnboardingState(getDefaultOnboardingState())
}

export { ONBOARDING_KEY }

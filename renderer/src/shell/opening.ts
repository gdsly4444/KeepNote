export function chooseOpening(input: {
  paths: readonly string[]
  desk: { today: string; day: string; path: string | null } | null
}): { action: 'restore'; path: string } | { action: 'today' } {
  const path = input.desk?.path
  if (path && input.desk?.day === input.desk?.today && input.paths.includes(path)) {
    return { action: 'restore', path }
  }
  return { action: 'today' }
}

export function quitsWhenLastWindowCloses(platform: NodeJS.Platform = process.platform): boolean {
  return platform !== 'darwin'
}

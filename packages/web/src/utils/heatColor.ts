export function heatClass(count: number): string {
  if (count >= 7) return 'text-c-heat-very-hot font-bold'
  if (count >= 5) return 'text-c-heat-hot font-bold'
  if (count >= 3) return 'text-c-heat-warm'
  return ''
}

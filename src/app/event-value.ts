export function eventValue(event: Event): string {
  const target = event.target;
  if (target && 'value' in target && typeof target.value === 'string') {
    return target.value;
  }
  return '';
}


export function jsonToolResult(value: object | string | number | boolean | null) {
  let text = '';
  if (typeof value === 'string') {
    text = value;
  } else {
    text = JSON.stringify(value, null, 2);
  }
  return {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

export function toolError(message: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: message,
      },
    ],
    isError: true,
  };
}

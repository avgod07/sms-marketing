export interface ParsedError {
  status?: number;
  message?: string;
  errors?: { message?: string }[];
}

function parseError(err: unknown): ParsedError {
  let msg = '';
  if (err instanceof Error) msg = err.message;
  else if (typeof err === 'string') msg = err;
  const result: ParsedError = {};
  const match = msg.match(/^(\d{3}):\s*(.*)$/);
  if (match) {
    result.status = parseInt(match[1], 10);
    msg = match[2];
  }
  if (msg.startsWith('Network error')) {
    result.message = 'Network error';
    return result;
  }
  try {
    const data = JSON.parse(msg);
    if (data && typeof data === 'object') {
      result.message = data.message;
      if (Array.isArray(data.errors)) {
        result.errors = data.errors;
      }
      return result;
    }
  } catch {
    // not JSON
  }
  result.message = msg;
  return result;
}

export function handleApiError(error: unknown, defaultMessage = 'Something went wrong, please try again later'): string {
  const { status, message, errors } = parseError(error);
  if (message === 'Network error') {
    return 'Unable to reach the server. Please check your connection.';
  }
  if (errors && errors.length > 0 && errors[0].message) {
    return errors[0].message;
  }
  if (status === 401 || message?.toLowerCase() === 'unauthorized') {
    return 'Incorrect username or password';
  }
  if (message === 'Coupon not found') {
    return 'This coupon is no longer active';
  }
  if (status && status >= 500) {
    return defaultMessage;
  }
  return message || defaultMessage;
}

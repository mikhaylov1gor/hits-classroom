import type {
  LoginForm,
  LoginRequest,
  LoginResponse,
  RegisterForm,
  RegisterRequest,
  User,
} from '../model/types'

const API_BASE = '/api/v1'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

export async function loginApi(form: LoginForm): Promise<LoginResponse> {
  const body: LoginRequest = {
    email: form.email,
    password: form.password,
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })

  if (response.status === 401) {
    const error = new Error('INVALID_CREDENTIALS')
    throw error
  }

  if (!response.ok) {
    throw new Error('LOGIN_FAILED')
  }

  const data = (await response.json()) as LoginResponse
  return data
}

export async function registerApi(form: RegisterForm): Promise<User> {
  const trimmedFullName = form.fullName.trim()
  const [first, ...rest] = trimmedFullName.split(/\s+/)
  const first_name = first ?? ''
  const last_name = rest.join(' ') || first_name

  const body: RegisterRequest = {
    email: form.email,
    password: form.password,
    first_name,
    last_name,
    birth_date: form.birthDate,
  }

  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })

  if (response.status === 409) {
    const error = new Error('EMAIL_EXISTS')
    throw error
  }

  if (!response.ok) {
    throw new Error('REGISTER_FAILED')
  }

  const user = (await response.json()) as User
  return user
}



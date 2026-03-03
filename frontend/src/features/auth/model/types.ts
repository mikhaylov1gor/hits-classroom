export type User = {
  id: string
  email: string
  first_name: string
  last_name: string
  birth_date: string
  created_at: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  token: string
  user: User
}

export type RegisterRequest = {
  email: string
  password: string
  first_name: string
  last_name: string
  birth_date: string
}

export type LoginForm = {
  email: string
  password: string
}

export type RegisterForm = {
  email: string
  password: string
  confirmPassword: string
  fullName: string
  birthDate: string
}



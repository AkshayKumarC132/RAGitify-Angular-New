export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  organization?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  first_name: string;
  last_name: string;
}

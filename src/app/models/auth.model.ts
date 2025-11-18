export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  tenant: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  tenant_name: string;
  first_name?: string;
  last_name?: string;
  collection_name?: string;
}

export interface ProtectedUserResponse {
  user: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    tenant: number;
  };
  token: string;
}

export type UserProfile = AuthUser;

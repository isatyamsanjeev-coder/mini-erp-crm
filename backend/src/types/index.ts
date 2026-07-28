import { Request } from 'express';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

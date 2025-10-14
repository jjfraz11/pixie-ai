export interface User {
  id: string;
  email: string;
  name?: string; // Optional since backend might not provide it
  roles?: string[];
  createdAt?: string;
  updatedAt?: string;
}

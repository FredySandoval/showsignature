// ------------------------------
// File: test1.ts
// ------------------------------
// Define an interface
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

// Create a class that implements the interface
class UserAccount implements User {
  constructor(
    public id: number,
    public name: string,
    public email: string,
    public isActive: boolean = true,
  ) {}

  // Method with return type annotation
  deactivate(): void {
    this.isActive = false;
  }

  getProfile(): string {
    return `${this.name} (${this.email}) - Active: ${this.isActive}`;
  }
}

// Function with typed parameter and return type
function createUser(id: number, name: string, email: string): UserAccount {
  return new UserAccount(id, name, email);
}

// Usage example
const user1 = createUser(1, "Alice", "alice@example.com");

console.log(user1.getProfile());

user1.deactivate();
console.log(user1.getProfile());

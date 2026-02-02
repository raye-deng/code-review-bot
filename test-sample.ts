// Sample code with intentional issues for testing
export function calculatePrice(price: number, tax: number) {
  console.log('Calculating price...'); // ESLint: no-console warning
  const result = price * (1 + tax); // Unused variable 'result'
  return result;
}

export function validateEmail(email: string): any {
  // ESLint: @typescript-eslint/no-explicit-any warning
  return email.includes('@');
}

export function getUserData() {
  const data = {
    name: 'John',
    age: 30,
  };
  
  // Missing return type annotation
  return data;
}

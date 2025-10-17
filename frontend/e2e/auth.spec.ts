import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow a user to register and then log in', async ({ page }) => {
    // Navigate to the registration page
    await page.goto('/register');

    // Fill out the registration form
    await page.fill('input[name="email"]', `test-user-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // Expect to be redirected to the login page or a success message
    await expect(page).toHaveURL('/login'); // Assuming successful registration redirects to login

    // Fill out the login form
    const email = page.locator('input[name="email"]').inputValue(); // Get the email used for registration
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // Expect to be redirected to the dashboard or a protected page
    await expect(page).toHaveURL('/dashboard'); // Assuming successful login redirects to dashboard
    await expect(page.locator('text=Welcome')).toBeVisible(); // Assuming a welcome message is displayed
  });

  test('should display an error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible(); // Assuming an error message is displayed
  });
});

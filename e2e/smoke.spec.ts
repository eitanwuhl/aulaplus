import { test, expect } from '@playwright/test';

test.describe('public smoke', () => {
  test('home shows role selection', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Aula\+/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar como Docente/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar como Alumno/i })).toBeVisible();
  });

  test('teacher login screen loads', async ({ page }) => {
    await page.goto('/teacher-login');
    await expect(page.getByRole('heading', { name: /Acceso Docente/i })).toBeVisible();
    await expect(page.getByLabel(/Código o correo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ingresar$/i })).toBeVisible();
  });

  test('protected planificacion route redirects unauthenticated users', async ({ page }) => {
    await page.goto('/planificacion');
    await expect(page).not.toHaveURL(/\/planificacion$/);
  });

  test('protected programa anual route redirects unauthenticated users', async ({ page }) => {
    await page.goto('/programa-anual');
    await expect(page).not.toHaveURL(/\/programa-anual$/);
  });
});

test.describe('staging M2→M3 flow', () => {
  test.skip(
    !process.env.E2E_TEACHER_CODE || !process.env.E2E_TEACHER_PASSWORD,
    'requires E2E_TEACHER_CODE and E2E_TEACHER_PASSWORD'
  );

  test('teacher can open planificacion and programa anual', async ({ page }) => {
    await page.goto('/teacher-login');
    await page.getByLabel(/Código o correo/i).fill(process.env.E2E_TEACHER_CODE!);
    await page.getByLabel(/Contraseña/i).fill(process.env.E2E_TEACHER_PASSWORD!);
    await page.getByRole('button', { name: /^Ingresar$/i }).click();

    await page.waitForURL(/teacher-dashboard/, { timeout: 30_000 });

    await page.goto('/programa-anual');
    await expect(page).toHaveURL(/programa-anual/);

    await page.goto('/planificacion');
    await expect(page).toHaveURL(/planificacion/);
  });
});

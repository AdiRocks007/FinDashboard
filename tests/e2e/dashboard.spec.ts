import { test, expect } from '@playwright/test'

test('dashboard loads correctly', async ({ page }) => {
  await page.goto('/')
  
  // Check if the main heading is visible
  await expect(page.getByRole('heading', { name: 'FinBoard' })).toBeVisible()
  
  // Check if the welcome message is present
  await expect(page.getByText('Welcome to FinBoard')).toBeVisible()
  
  // Check if the Add Widget button is present
  await expect(page.getByRole('button', { name: 'Add Widget' })).toBeVisible()
})
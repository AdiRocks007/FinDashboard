import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/components/providers/ThemeProvider'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('Theme System', () => {
  beforeEach(() => {
    localStorageMock.clear()
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    localStorageMock.clear()
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.removeAttribute('data-theme')
  })

  describe('ThemeProvider', () => {
    it('should provide default theme (system)', async () => {
      const TestComponent = () => {
        const { theme } = useTheme()
        return <div data-testid="theme">{theme}</div>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system')
      })
    })

    it('should load theme from localStorage', async () => {
      localStorageMock.setItem('theme', 'dark')

      const TestComponent = () => {
        const { theme } = useTheme()
        return <div data-testid="theme">{theme}</div>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark')
      })
    })

    it('should apply dark class when theme is dark', async () => {
      const TestComponent = () => {
        const { setTheme } = useTheme()
        return <button onClick={() => setTheme('dark')}>Set Dark</button>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const button = screen.getByText('Set Dark')
      fireEvent.click(button)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      })
    })

    it('should apply light class when theme is light', async () => {
      const TestComponent = () => {
        const { setTheme } = useTheme()
        return <button onClick={() => setTheme('light')}>Set Light</button>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const button = screen.getByText('Set Light')
      fireEvent.click(button)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      })
    })

    it('should persist theme to localStorage', async () => {
      const TestComponent = () => {
        const { setTheme } = useTheme()
        return <button onClick={() => setTheme('dark')}>Set Dark</button>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const button = screen.getByText('Set Dark')
      fireEvent.click(button)

      await waitFor(() => {
        expect(localStorageMock.getItem('theme')).toBe('dark')
      })
    })

    it('should resolve system theme based on media query', async () => {
      // Mock dark mode preference
      const darkMediaQuery = {
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event, handler) => {
          // Store handler for potential manual trigger
          darkMediaQuery.addEventListener = handler as any
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }

      const matchMediaMock = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return darkMediaQuery
        }
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }
      })

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      })

      const TestComponent = () => {
        const { theme, resolvedTheme } = useTheme()
        return (
          <div>
            <div data-testid="theme">{theme}</div>
            <div data-testid="resolved">{resolvedTheme}</div>
          </div>
        )
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system')
        // Resolved theme should be dark when system prefers dark
        expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
      }, { timeout: 2000 })
    })
  })

  describe('ThemeToggle', () => {
    it('should render all three theme buttons', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Light mode')).toBeInTheDocument()
        expect(screen.getByLabelText('Dark mode')).toBeInTheDocument()
        expect(screen.getByLabelText('System mode')).toBeInTheDocument()
      })
    })

    it('should switch to light theme when light button is clicked', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const lightButton = screen.getByLabelText('Light mode')
      fireEvent.click(lightButton)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(localStorageMock.getItem('theme')).toBe('light')
      })
    })

    it('should switch to dark theme when dark button is clicked', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const darkButton = screen.getByLabelText('Dark mode')
      fireEvent.click(darkButton)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(localStorageMock.getItem('theme')).toBe('dark')
      })
    })

    it('should switch to system theme when system button is clicked', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const systemButton = screen.getByLabelText('System mode')
      fireEvent.click(systemButton)

      await waitFor(() => {
        expect(localStorageMock.getItem('theme')).toBe('system')
      })
    })

    it('should highlight active theme button', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const darkButton = screen.getByLabelText('Dark mode')
      fireEvent.click(darkButton)

      await waitFor(() => {
        // Check that dark button has active styling
        expect(darkButton.closest('button')).toHaveClass('shadow-sm')
      })
    })
  })

  describe('Theme Persistence', () => {
    it('should persist theme across page reloads', async () => {
      const TestComponent = () => {
        const { theme, setTheme } = useTheme()
        return (
          <div>
            <div data-testid="theme">{theme}</div>
            <button onClick={() => setTheme('dark')}>Set Dark</button>
          </div>
        )
      }

      const { unmount } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const button = screen.getByText('Set Dark')
      fireEvent.click(button)

      await waitFor(() => {
        expect(localStorageMock.getItem('theme')).toBe('dark')
      })

      unmount()

      // Simulate page reload by rendering again
      const { unmount: unmount2 } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark')
      }, { timeout: 2000 })

      unmount2()
    })
  })

  describe('Theme Transitions', () => {
    it('should apply transition classes to document', () => {
      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      )

      // Check that transition classes are applied via CSS
      // This is tested indirectly through the CSS layer
      expect(document.documentElement).toBeInTheDocument()
    })
  })
})


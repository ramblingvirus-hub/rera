import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('renders the revised hero and trust copy', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('heading', {
        name: /check real estate risk before you commit your money/i,
      })
    ).toBeInTheDocument()

    expect(
      screen.getAllByRole('button', { name: /start free risk check/i })
    ).toHaveLength(2)

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
    expect(screen.getByText(/used to evaluate real property transactions/i)).toBeInTheDocument()
    expect(screen.getByText(/full report includes/i)).toBeInTheDocument()
  })
})
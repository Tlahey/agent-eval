import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter, Route, Routes, type MemoryRouterProps } from "react-router-dom";
import { type ReactElement } from "react";

interface WrapperOptions extends RenderOptions {
  routerProps?: MemoryRouterProps;
}

/**
 * Custom render that wraps components in MemoryRouter for tests
 * needing React Router context (NavLink, useParams, etc.).
 */
export function renderWithRouter(ui: ReactElement, options: WrapperOptions = {}) {
  const { routerProps, ...renderOptions } = options;
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter {...routerProps}>{children}</MemoryRouter>;
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

import { RunProvider } from "../lib/contexts/RunContext";

/**
 * Render a page component inside providers.
 */
export function renderPage(
  pageElement: ReactElement,
  options: WrapperOptions & { path?: string } = {},
) {
  const { routerProps, path = "/", ...renderOptions } = options;

  return render(
    <MemoryRouter initialEntries={[path]} {...routerProps}>
      <RunProvider>
        <Routes>
          <Route path={path} element={pageElement} />
          {/* Catch-all for dynamic paths */}
          <Route path="/evals/:testId" element={pageElement} />
        </Routes>
      </RunProvider>
    </MemoryRouter>,
    renderOptions,
  );
}

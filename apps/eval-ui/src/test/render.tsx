import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter, Route, Routes, type MemoryRouterProps } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useState, type ReactElement } from "react";
import type { LedgerRun } from "../lib/api";

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

/**
 * Render a page component inside an outlet that provides AppContext.
 * Useful for pages that call useOutletContext<AppContext>().
 */
export function renderPage(
  pageElement: ReactElement,
  options: WrapperOptions & { path?: string } = {},
) {
  const { routerProps, path = "/", ...renderOptions } = options;

  function LayoutWithContext() {
    const [selectedRun, setSelectedRun] = useState<LedgerRun | null>(null);
    return <Outlet context={{ selectedRun, setSelectedRun }} />;
  }

  return render(
    <MemoryRouter initialEntries={[path]} {...routerProps}>
      <Routes>
        <Route element={<LayoutWithContext />}>
          <Route path={path} element={pageElement} />
          {/* Catch-all for dynamic paths */}
          <Route path="/evals/:testId" element={pageElement} />
        </Route>
      </Routes>
    </MemoryRouter>,
    renderOptions,
  );
}

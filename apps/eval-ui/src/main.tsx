import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { App } from "./App";
import { Overview } from "./pages/Overview";
import { Runs } from "./pages/Runs";
import { EvalDetail } from "./pages/EvalDetail";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Overview />} />
          <Route path="runs" element={<Runs />} />
          <Route path="evals/:testId" element={<EvalDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
